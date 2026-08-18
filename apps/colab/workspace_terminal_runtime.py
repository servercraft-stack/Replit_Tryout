import threading
from pathlib import Path

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

from . import terminals


_readers = {}
_lock = threading.Lock()


def _project_dir(project_id):
    root = Path(settings.WORKSPACE_LOCAL_STORAGE_ROOT).resolve()
    project_path = root / f"projects/{project_id}"
    project_path.mkdir(parents=True, exist_ok=True)
    return str(project_path)


def start(session):
    cwd = _project_dir(session.project_id)
    terminals.open_shell(session.id, session.shell_type, cwd=cwd)
    with _lock:
        if session.id not in _readers:
            thread = threading.Thread(target=_read, args=(session.id,), daemon=True)
            _readers[session.id] = thread
            thread.start()


def write(session_id, data):
    terminals.write_shell(session_id, data)


def resize(session_id, cols, rows):
    terminals.resize_terminal(session_id, int(cols), int(rows))


def _read(session_id):
    layer = get_channel_layer()
    while session_id in terminals._sessions:
        try:
            data = terminals.read_shell(session_id)
            if data is None:
                continue
            async_to_sync(layer.group_send)(f"workspace_terminal_{session_id}", {"type": "terminal.output", "data": data})
        except OSError:
            break
    with _lock:
        _readers.pop(session_id, None)


def stop_shell(session_id):
    terminals.close_shell(session_id)


def stop_session(session_id):
    stop_shell(session_id)
