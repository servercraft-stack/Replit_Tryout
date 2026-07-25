import asyncio
import json
import os
import select
import threading

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebSocketConsumer
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

class BoardConsumer(AsyncWebSocketConsumer):
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

class FileConsumer(AsyncWebSocketConsumer):
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
# Terminal Consumer — bidirectional PTY I/O
# ---------------------------------------------------------------------------

class TerminalConsumer(AsyncWebSocketConsumer):
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
                r, _, _ = select.select([self.master_fd], [], [], 0.1)
                if r:
                    data = os.read(self.master_fd, 4096)
                    if not data:
                        break
                    asyncio.run_coroutine_threadsafe(
                        self.send_json({"type": "terminal.output", "data": data.decode(errors="replace")}),
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
        return terminals.open_shell(self.session.project_id, self.session.shell_type)

    @database_sync_to_async
    def _mark_stopped(self):
        self.session.status = TerminalSession.Status.STOPPED
        self.session.save(update_fields=["status", "updated_at"])
