import threading
import time

from pycrdt import Doc, Text

_docs: dict[int, Doc] = {}
_lock = threading.Lock()
_checkpoint_timers: dict[int, threading.Timer] = {}


def open_doc(file_node) -> Doc:
    with _lock:
        if file_node.id not in _docs:
            doc = Doc()
            doc["content"] = Text(file_node.content or "")
            _docs[file_node.id] = doc
        return _docs[file_node.id]


def checkpoint(file_node):
    """Persist the CRDT doc state back to the database."""
    with _lock:
        doc = _docs.get(file_node.id)
        if doc is None:
            return
        file_node.content = str(doc["content"])
        file_node.version += 1
        file_node.save(update_fields=["content", "version", "updated_at"])


def schedule_checkpoint(file_node, delay=5.0):
    """Debounce checkpoint writes — coalesce rapid edits into one DB write."""
    with _lock:
        existing = _checkpoint_timers.get(file_node.id)
        if existing is not None:
            existing.cancel()

        timer = threading.Timer(delay, _do_checkpoint, args=[file_node.id])
        timer.daemon = True
        _checkpoint_timers[file_node.id] = timer
        timer.start()


def _do_checkpoint(file_node_id):
    from .models import FileNode

    with _lock:
        _checkpoint_timers.pop(file_node_id, None)

    try:
        file_node = FileNode.objects.get(id=file_node_id)
        checkpoint(file_node)
    except FileNode.DoesNotExist:
        pass


def close_doc(file_node_id):
    with _lock:
        _docs.pop(file_node_id, None)
        timer = _checkpoint_timers.pop(file_node_id, None)
        if timer is not None:
            timer.cancel()
