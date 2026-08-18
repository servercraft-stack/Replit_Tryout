import json
import logging
import threading
from datetime import datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

from . import terminals
from .sandbox import get_manager

logger = logging.getLogger(__name__)

_readers = {}
_lock = threading.Lock()
_fallback_runtime = None


def _get_fallback_runtime():
    global _fallback_runtime
    if _fallback_runtime is None:
        from . import workspace_terminal_runtime
        _fallback_runtime = workspace_terminal_runtime
    return _fallback_runtime


def _group(session_id):
    return f"workspace_terminal_{session_id}"


def start(session):
    try:
        manager = get_manager()
        sandbox = manager.start_session(str(session.id), session.project_id)

        session.status = "running"
        session.container_id = sandbox.container_id
        session.container_status = "running"
        session.save(update_fields=["status", "container_id", "container_status", "updated_at"])

        with _lock:
            if session.id not in _readers:
                thread = threading.Thread(target=_read, args=(session.id,), daemon=True)
                _readers[session.id] = thread
                thread.start()
    except Exception as exc:
        logger.warning("Docker sandbox unavailable, falling back to host terminal: %s", exc)
        session.status = "running"
        session.container_status = "host"
        session.save(update_fields=["status", "container_status", "updated_at"])
        fallback = _get_fallback_runtime()
        fallback.start(session)


def write(session_id, data):
    try:
        sandbox = get_manager().get_session(str(session_id))
        if sandbox is not None:
            sandbox.write(data)
            return
    except Exception:
        pass
    _get_fallback_runtime().write(session_id, data)


def resize(session_id, cols, rows):
    try:
        sandbox = get_manager().get_session(str(session_id))
        if sandbox is not None:
            sandbox.resize(cols, rows)
            return
    except Exception:
        pass
    _get_fallback_runtime().resize(session_id, cols, rows)


def output_history(session_id):
    return ""


def _read(session_id):
    import queue as _queue
    layer = get_channel_layer()
    sandbox = get_manager().get_session(str(session_id))

    if sandbox is None:
        return

    try:
        while not sandbox._stop.is_set():
            try:
                data = sandbox.command_queue.get(timeout=0.1)
                if not data:
                    continue
                async_to_sync(layer.group_send)(_group(session_id), {"type": "terminal.output", "data": data})
            except _queue.Empty:
                continue
    except Exception:
        pass
    finally:
        with _lock:
            _readers.pop(session_id, None)


def stop_session(session_id):
    with _lock:
        _readers.pop(session_id, None)
    try:
        get_manager().stop_session(str(session_id))
    except Exception:
        pass
    try:
        _get_fallback_runtime().stop_shell(session_id)
    except Exception:
        pass
