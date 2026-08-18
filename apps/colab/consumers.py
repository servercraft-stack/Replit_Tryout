import asyncio
import json
import os
import threading

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer, AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from . import terminals, live_docs
from .models import (
    Board,
    Card,
    CollaborationEvent,
    FileNode,
    Project,
    TerminalSession,
    WorkspaceMember,
)


def _user_has_board_access(user, board_id):
    if user.is_anonymous:
        return False
    return Board.objects.filter(
        id=board_id,
        workspace__members__user=user,
    ).exists()


def _user_has_project_access(user, project_id):
    if user.is_anonymous:
        return False
    return Project.objects.filter(
        id=project_id,
        workspace__members__user=user,
    ).exists()


def _user_has_editor_access(user, project_id):
    """Check if user has editor or above role in the project's workspace."""
    if user.is_anonymous:
        return False
    return WorkspaceMember.objects.filter(
        project__id=project_id,
        workspace__projects__id=project_id,
        user=user,
        role__in=[WorkspaceMember.Role.EDITOR, WorkspaceMember.Role.ADMIN, WorkspaceMember.Role.OWNER],
    ).exists()


# ---------------------------------------------------------------------------
# Board Consumer — live card updates + presence
# ---------------------------------------------------------------------------

class BoardConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.board_id = self.scope["url_route"]["kwargs"]["board_id"]
        self.user = self.scope.get("user", AnonymousUser())
        self.group_name = f"board_{self.board_id}"

        if self.user.is_anonymous or not await self._has_access():
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.join",
                "actor_id": self.user.id,
                "actor_name": self.user.get_short_name() or self.user.email,
            },
        )

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "presence.leave",
                    "actor_id": self.user.id,
                },
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type", "")
        request_id = content.get("request_id")
        payload = content.get("payload", {})

        handlers = {
            "card.create": self._handle_card_create,
            "card.update": self._handle_card_update,
            "card.move": self._handle_card_move,
            "card.delete": self._handle_card_delete,
            "cursor.move": self._handle_cursor_move,
            "selection.change": self._handle_selection_change,
        }

        handler = handlers.get(event_type)
        if not handler:
            await self._send_error(request_id, "unknown_event", f"Unknown event: {event_type}")
            return

        result = await handler(payload, request_id)
        if result is not None:
            await self._send_ack(request_id, result)

    # -- Card handlers -------------------------------------------------------

    @database_sync_to_async
    def _handle_card_create(self, payload, request_id):
        column_id = payload.get("column_id")
        title = payload.get("title", "Untitled")
        body = payload.get("body", "")
        position = payload.get("position", 0)

        card = Card.objects.create(
            column_id=column_id,
            title=title,
            body=body,
            position=position,
            updated_by=self.user,
        )
        event = CollaborationEvent.objects.create(
            workspace=card.column.board.workspace,
            board=card.column.board,
            actor=self.user,
            event_type="card.created",
            payload={"card_id": card.id, "title": title},
            entity_type="card",
            entity_id=card.id,
            entity_version=card.version,
        )
        return {
            "card_id": card.id,
            "title": card.title,
            "body": card.body,
            "column_id": column_id,
            "position": card.position,
            "version": card.version,
        }

    @database_sync_to_async
    def _handle_card_update(self, payload, request_id):
        card_id = payload.get("card_id")
        base_version = payload.get("base_version")
        changes = payload.get("changes", {})

        card = Card.objects.get(id=card_id)
        if base_version is not None and base_version != card.version:
            return {"conflict": True, "server_version": card.version, "card_id": card_id}

        for field in ("title", "body", "position"):
            if field in changes:
                setattr(card, field, changes[field])
        card.updated_by = self.user
        card.version += 1
        card.save(update_fields=["title", "body", "position", "version", "updated_by", "updated_at"])

        CollaborationEvent.objects.create(
            workspace=card.column.board.workspace,
            board=card.column.board,
            actor=self.user,
            event_type="card.updated",
            payload={"card_id": card.id, "changes": changes},
            entity_type="card",
            entity_id=card.id,
            entity_version=card.version,
        )
        return {"card_id": card.id, "version": card.version}

    @database_sync_to_async
    def _handle_card_move(self, payload, request_id):
        card_id = payload.get("card_id")
        new_column_id = payload.get("column_id")
        new_position = payload.get("position", 0)

        card = Card.objects.get(id=card_id)
        card.column_id = new_column_id
        card.position = new_position
        card.updated_by = self.user
        card.version += 1
        card.save(update_fields=["column", "position", "version", "updated_by", "updated_at"])

        CollaborationEvent.objects.create(
            workspace=card.column.board.workspace,
            board=card.column.board,
            actor=self.user,
            event_type="card.moved",
            payload={"card_id": card.id, "column_id": new_column_id, "position": new_position},
            entity_type="card",
            entity_id=card.id,
            entity_version=card.version,
        )
        return {"card_id": card.id, "column_id": new_column_id, "position": new_position, "version": card.version}

    @database_sync_to_async
    def _handle_card_delete(self, payload, request_id):
        card_id = payload.get("card_id")
        card = Card.objects.get(id=card_id)
        board = card.column.board
        workspace = board.workspace
        card.delete()

        CollaborationEvent.objects.create(
            workspace=workspace,
            board=board,
            actor=self.user,
            event_type="card.deleted",
            payload={"card_id": card_id},
            entity_type="card",
            entity_id=card_id,
        )
        return {"card_id": card_id}

    # -- Presence handlers (broadcast only, no DB) ---------------------------

    async def _handle_cursor_move(self, payload, request_id):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "cursor.moved",
                "actor_id": self.user.id,
                "payload": payload,
            },
        )
        return None

    async def _handle_selection_change(self, payload, request_id):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "selection.changed",
                "actor_id": self.user.id,
                "payload": payload,
            },
        )
        return None

    # -- Group message handlers ----------------------------------------------

    async def presence_join(self, event):
        await self.send_json({
            "type": "presence.join",
            "actor_id": event["actor_id"],
            "actor_name": event.get("actor_name", ""),
        })

    async def presence_leave(self, event):
        await self.send_json({
            "type": "presence.leave",
            "actor_id": event["actor_id"],
        })

    async def cursor_moved(self, event):
        if event["actor_id"] != self.user.id:
            await self.send_json({
                "type": "cursor.move",
                "actor_id": event["actor_id"],
                "payload": event["payload"],
            })

    async def selection_changed(self, event):
        if event["actor_id"] != self.user.id:
            await self.send_json({
                "type": "selection.change",
                "actor_id": event["actor_id"],
                "payload": event["payload"],
            })

    # -- Helpers -------------------------------------------------------------

    async def _send_ack(self, request_id, result):
        await self.send_json({
            "type": "ack",
            "request_id": request_id,
            "payload": result,
        })

    async def _send_error(self, request_id, code, message):
        await self.send_json({
            "type": "error",
            "request_id": request_id,
            "code": code,
            "message": message,
        })

    @database_sync_to_async
    def _has_access(self):
        return _user_has_board_access(self.user, self.board_id)


# ---------------------------------------------------------------------------
# File Consumer — collaborative code editing via CRDT
# ---------------------------------------------------------------------------

class FileConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.file_id = self.scope["url_route"]["kwargs"]["file_id"]
        self.user = self.scope.get("user", AnonymousUser())
        self.group_name = f"file_{self.file_id}"

        if self.user.is_anonymous or not await self._has_access():
            await self.close()
            return

        self.file_node = await self._get_file_node()
        if self.file_node is None:
            await self.close()
            return

        self.doc = await self._open_doc()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_json({
            "type": "doc.init",
            "file_id": self.file_id,
            "content": str(self.doc["content"]),
            "version": self.file_node.version,
        })

    async def disconnect(self, code):
        if hasattr(self, "doc") and hasattr(self, "file_node"):
            await self._checkpoint()
            live_docs.close_doc(self.file_node.id)
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type", "")

        if event_type == "doc.update":
            await self._handle_doc_update(content)
        elif event_type == "doc.cursor":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "doc.cursor",
                    "actor_id": self.user.id,
                    "payload": content.get("payload", {}),
                },
            )

    async def _handle_doc_update(self, content):
        update_bytes = content.get("update")
        if update_bytes is None:
            return

        try:
            import base64
            update = base64.b64decode(update_bytes)
            self.doc.apply_update(update)
        except Exception:
            await self.send_json({"type": "error", "code": "invalid_update"})
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "doc.update",
                "actor_id": self.user.id,
                "update": update_bytes,
            },
        )

    async def doc_update(self, event):
        if event["actor_id"] != self.user.id:
            await self.send_json({
                "type": "doc.update",
                "actor_id": event["actor_id"],
                "update": event["update"],
            })

    async def doc_cursor(self, event):
        if event["actor_id"] != self.user.id:
            await self.send_json({
                "type": "doc.cursor",
                "actor_id": event["actor_id"],
                "payload": event["payload"],
            })

    @database_sync_to_async
    def _has_access(self):
        return _user_has_project_access(
            self.user,
            FileNode.objects.filter(id=self.file_id).values_list("project_id", flat=True).first(),
        )

    @database_sync_to_async
    def _get_file_node(self):
        try:
            return FileNode.objects.select_related("project").get(
                id=self.file_id,
                node_type=FileNode.NodeType.FILE,
            )
        except FileNode.DoesNotExist:
            return None

    @database_sync_to_async
    def _open_doc(self):
        return live_docs.open_doc(self.file_node)

    @database_sync_to_async
    def _checkpoint(self):
        live_docs.checkpoint(self.file_node)


# ---------------------------------------------------------------------------
# Yjs WebSocket Consumer — implements minimal y-websocket update + awareness handling
# ---------------------------------------------------------------------------

class YjsWebsocketConsumer(AsyncJsonWebsocketConsumer):
    """
    A lightweight Channels consumer that speaks the Yjs / y-websocket update and awareness
    message conventions at a minimal level:

    - Accepts binary messages where the first byte is the message type (2 == update, 3 == awareness).
    - Applies incoming updates to a server-side YDoc (via yjs_live), broadcasts to other clients in the room,
      and schedules a debounced checkpoint to persist the document every ~5s of inactivity.

    Notes:
    - This consumer requires the `y_py` package to be installed (added to pyproject.toml).
    - Channel layer broadcasts carry base64-encoded payloads so they are safe to transport.
    """

    async def connect(self):
        self.file_id = self.scope["url_route"]["kwargs"]["file_id"]
        self.user = self.scope.get("user", AnonymousUser())
        self.group_name = f"yjs_file_{self.file_id}"

        if self.user.is_anonymous or not await self._has_access():
            await self.close()
            return

        self.file_node = await self._get_file_node()
        if self.file_node is None:
            await self.close()
            return

        # open (or create) the server-side Y.Doc for this file
        try:
            from . import yjs_live
            self.ydoc = yjs_live.open_doc(self.file_node)
        except Exception:
            # If y_py is not available raise a clear error to logs and close
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send full document state as an "update" (message type 2) so client can sync
        try:
            update = yjs_live.encode_state_as_update(self.ydoc)
            # send binary message: first byte is msg type
            await self.send(bytes=bytes([2]) + update)
        except Exception:
            # best-effort — non-fatal
            pass

    async def disconnect(self, code):
        # Schedule a final checkpoint and tidy the server-side doc
        try:
            from . import yjs_live
            yjs_live.schedule_checkpoint(self.file_node, delay=0.0)
            yjs_live.close_doc(self.file_node.id)
        except Exception:
            pass

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # We only operate on binary messages (y-websocket uses binary frames)
        if bytes_data is None:
            return

        if len(bytes_data) == 0:
            return

        msg_type = bytes_data[0]
        payload = bytes_data[1:]

        # message types: 2 == update, 3 == awareness
        if msg_type == 2:
            # Apply update to server Y.Doc and broadcast to group
            try:
                from . import yjs_live
                yjs_live.apply_update(self.ydoc, payload)
            except Exception:
                # best-effort: ignore invalid updates
                await self.send_json({"type": "error", "code": "invalid_update"})
                return

            # Broadcast base64-encoded payload via channel layer
            import base64
            encoded = base64.b64encode(payload).decode()
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "yjs.broadcast",
                    "actor_id": self.user.id,
                    "msg_type": 2,
                    "payload": encoded,
                },
            )

            # schedule debounced checkpoint of the YDoc
            try:
                from . import yjs_live
                yjs_live.schedule_checkpoint(self.file_node, delay=5.0)
            except Exception:
                pass

        elif msg_type == 3:
            # Awareness messages are forwarded to other clients
            import base64
            encoded = base64.b64encode(payload).decode()
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "yjs.broadcast",
                    "actor_id": self.user.id,
                    "msg_type": 3,
                    "payload": encoded,
                },
            )

    async def yjs_broadcast(self, event):
        """Channel layer handler for broadcasting yjs messages to WebSocket clients.

        This method receives events placed on the group by receive() and forwards the
        binary frame to connected clients. Originating client is filtered by actor_id.
        """
        if event.get("actor_id") == getattr(self.user, "id", None):
            return

        import base64
        data = base64.b64decode(event["payload"])
        msg = bytes([event["msg_type"]]) + data
        await self.send(bytes=msg)


# ---------------------------------------------------------------------------
# Terminal Consumer — bidirectional PTY I/O
# ---------------------------------------------------------------------------

class LegacyTerminalConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.user = self.scope.get("user", AnonymousUser())

        if self.user.is_anonymous or not await self._has_editor_access():
            await self.close()
            return

        self.session = await self._get_session()
        if self.session is None:
            await self.close()
            return

        self.master_fd = await self._open_shell()
        if self.master_fd is None:
            await self.close()
            return

        self._loop = asyncio.get_event_loop()
        self._reader_thread = threading.Thread(target=self._read_pty, daemon=True)
        self._reader_thread.start()
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "master_fd"):
            terminals.close_shell(self.session.project_id)
        if hasattr(self, "session") and self.session:
            await self._mark_stopped()

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type", "")

        if event_type == "terminal.input":
            data = content.get("data", "")
            if self.master_fd is not None:
                os.write(self.master_fd, data.encode())
        elif event_type == "terminal.resize":
            cols = content.get("cols", 80)
            rows = content.get("rows", 24)
            terminals.resize_terminal(self.session.project_id, cols, rows)

    def _read_pty(self):
        """Read from PTY in a background thread and push to the event loop."""
        while True:
            try:
                data = terminals.read_shell(self.session.project_id, timeout=0.1)
                if data is None:
                    continue
                if not data:
                    break
                asyncio.run_coroutine_threadsafe(
                    self.send_json({"type": "terminal.output", "data": data}),
                    self._loop,
                )
            except (OSError, ValueError):
                break

    @database_sync_to_async
    def _has_editor_access(self):
        try:
            session = TerminalSession.objects.select_related("project").get(id=self.session_id)
            return _user_has_editor_access(self.user, session.project_id)
        except TerminalSession.DoesNotExist:
            return False

    @database_sync_to_async
    def _get_session(self):
        try:
            return TerminalSession.objects.select_related("project").get(id=self.session_id)
        except TerminalSession.DoesNotExist:
            return None

    @database_sync_to_async
    def _open_shell(self):
        cwd = terminals.get_project_dir(self.session.project_id)
        return terminals.open_shell(self.session.project_id, self.session.shell_type, cwd=cwd)

    @database_sync_to_async
    def _mark_stopped(self):
        self.session.status = TerminalSession.Status.STOPPED
        self.session.save(update_fields=["status", "updated_at"])


class EditorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.token = self.scope["url_route"]["kwargs"]["token"]
        self.group_name = f"pair_editor_{self.token}"
        self.session = await self._session()
        if self.session is None:
            await self.close(code=4404)
            return
        from . import pair_docs

        self.document = await self._document()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(bytes=await self._state())

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            if not bytes_data:
                return
            try:
                await self._apply(bytes_data)
            except Exception:
                await self.close(code=4400)
                return
            await self.channel_layer.group_send(self.group_name, {"type": "editor.update", "data": bytes_data, "sender": self.channel_name})
            return
        if text_data is not None:
            try:
                message = json.loads(text_data)
            except json.JSONDecodeError:
                return
            if message.get("type") == "cursor":
                await self.channel_layer.group_send(self.group_name, {"type": "editor.cursor", "cursor": message.get("cursor", {}), "sender": self.channel_name})

    async def editor_update(self, event):
        if event["sender"] != self.channel_name:
            await self.send(bytes=event["data"])

    async def editor_cursor(self, event):
        if event["sender"] != self.channel_name:
            await self.send(text_data=json.dumps({"type": "cursor", "cursor": event["cursor"]}))

    @database_sync_to_async
    def _session(self):
        try:
            from .models import PairSession
            return PairSession.objects.get(token=self.token)
        except PairSession.DoesNotExist:
            return None

    @database_sync_to_async
    def _document(self):
        from . import pair_docs
        return pair_docs.get_doc(self.session)

    @database_sync_to_async
    def _state(self):
        from . import pair_docs
        return pair_docs.encode_state(self.document)

    @database_sync_to_async
    def _apply(self, update):
        from . import pair_docs
        pair_docs.apply_update(self.document, update)
        pair_docs.persist(self.token, self.document)


class TerminalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.token = self.scope["url_route"]["kwargs"]["token"]
        if not await self._session_exists():
            await self.close(code=4404)
            return
        self.group_name = f"pair_terminal_{self.token}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        history = await self._history()
        if history:
            await self.send(text_data=json.dumps({"type": "output", "data": history}))

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            return
        try:
            message = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if message.get("type") == "input" and isinstance(message.get("data"), str):
            await self._write(message["data"])
        if message.get("type") == "resize":
            try:
                columns = min(max(int(message.get("columns", 80)), 20), 500)
                rows = min(max(int(message.get("rows", 24)), 5), 200)
            except (TypeError, ValueError):
                return
            await self._resize(columns, rows)

    async def terminal_output(self, event):
        await self.send(text_data=json.dumps({"type": "output", "data": event["data"]}))

    @database_sync_to_async
    def _session_exists(self):
        from .models import PairSession
        return PairSession.objects.filter(token=self.token).exists()

    @database_sync_to_async
    def _history(self):
        from . import pair_runtime
        return pair_runtime.output_history(self.token)

    @database_sync_to_async
    def _write(self, data):
        from . import pair_runtime
        try:
            pair_runtime.write_shell(self.token, data)
        except OSError:
            pass

    @database_sync_to_async
    def _resize(self, columns, rows):
        from . import pair_runtime
        pair_runtime.resize_shell(self.token, columns, rows)


class WorkspaceEditorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.file_id = self.scope["url_route"]["kwargs"]["file_id"]
        self.user = self.scope.get("user", AnonymousUser())
        self.file_node = await self._file_node()
        if self.file_node is None:
            await self.close(code=4403)
            return
        self.group_name = f"workspace_editor_{self.file_id}"
        from . import workspace_docs

        self.document = await workspace_docs.open_document(self.file_node)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(bytes=await self._state())

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            try:
                await self._update(bytes_data)
            except Exception:
                await self.close(code=4400)
                return
            await self.channel_layer.group_send(self.group_name, {"type": "workspace.update", "data": bytes_data, "sender": self.channel_name})
        elif text_data:
            try:
                message = json.loads(text_data)
            except json.JSONDecodeError:
                return
            if message.get("type") == "awareness":
                await self.channel_layer.group_send(self.group_name, {"type": "workspace.awareness", "data": message.get("data", ""), "sender": self.channel_name})

    async def workspace_update(self, event):
        if event["sender"] != self.channel_name:
            await self.send(bytes=event["data"])

    async def workspace_awareness(self, event):
        if event["sender"] != self.channel_name:
            await self.send(text_data=json.dumps({"type": "awareness", "data": event["data"]}))

    @database_sync_to_async
    def _file_node(self):
        if self.user.is_anonymous:
            return None
        return FileNode.objects.filter(id=self.file_id, is_directory=False, project__workspace__members__user=self.user).first()

    @database_sync_to_async
    def _state(self):
        import y_py
        return y_py.encode_state_as_update(self.document)

    async def _update(self, update):
        from . import workspace_docs
        import y_py

        async with workspace_docs.lock(self.file_id):
            y_py.apply_update(self.document, update)
            await workspace_docs.save_document(self.file_node, self.document)


class WorkspaceTerminalConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.user = self.scope.get("user", AnonymousUser())
        self.session = await self._session()
        if self.session is None:
            await self.close(code=4403)
            return
        self.group_name = f"workspace_terminal_{self.session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self._start()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "session_id"):
            await self._cleanup()

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            return
        try:
            content = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if content.get("type") == "input" and isinstance(content.get("data"), str):
            data = content["data"]
            await self._input(data)
            await self._audit(data)
            self._command_count = getattr(self, "_command_count", 0) + 1
            if self._command_count % 50 == 0:
                await self._persist_count()
        elif content.get("type") == "resize":
            await self._resize(content.get("cols", 80), content.get("rows", 24))

    @database_sync_to_async
    def _session(self):
        if self.user.is_anonymous:
            return None
        return TerminalSession.objects.filter(id=self.session_id, project__workspace__members__user=self.user).first()

    @database_sync_to_async
    def _start(self):
        from .sandbox_runtime import start
        start(self.session)

    @database_sync_to_async
    def _input(self, data):
        from .sandbox_runtime import write
        write(self.session.id, data)

    @database_sync_to_async
    def _resize(self, cols, rows):
        from .sandbox_runtime import resize
        resize(self.session.id, cols, rows)

    @database_sync_to_async
    def _cleanup(self):
        from .sandbox_runtime import stop_session
        self.session.status = TerminalSession.Status.STOPPED
        self.session.save(update_fields=["status", "updated_at"])
        stop_session(self.session.id)

    @database_sync_to_async
    def _persist_count(self):
        self.session.command_count = getattr(self, "_command_count", self.session.command_count)
        self.session.save(update_fields=["command_count"])

    @database_sync_to_async
    def _audit(self, data):
        CollaborationEvent.objects.create(
            workspace=self.session.project.workspace,
            board=None,
            actor=self.user if not self.user.is_anonymous else None,
            event_type="terminal.command",
            payload={"command": data[:4096]},
            entity_type="terminal_session",
            entity_id=str(self.session.id),
        )

    async def terminal_output(self, event):
        await self.send_json({"type": "output", "data": event["data"]})
