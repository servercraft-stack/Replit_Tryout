import threading
import time
from typing import Dict

from django.utils import timezone

try:
    import y_py as y_py_pkg
    from y_py import YDoc
except Exception:  # pragma: no cover - import may fail if dependency not installed yet
    y_py_pkg = None
    YDoc = None

_ydocs: Dict[int, "YDoc"] = {}
_locks: Dict[int, threading.Lock] = {}
_checkpoint_timers: Dict[int, threading.Timer] = {}
_global_lock = threading.Lock()


def open_doc(file_node):
    """Open or create a YDoc for the given FileNode.

    Returns a Python YDoc instance (from y_py).
    """
    if y_py_pkg is None:
        raise RuntimeError("y_py is not installed; please add it to your environment")

    with _global_lock:
        if file_node.id not in _ydocs:
            doc = YDoc()
            with doc.begin_transaction() as t:
                ytext = doc.get_text("content")
                if file_node.content:
                    # insert the current content into YText
                    ytext.insert(t, 0, file_node.content)
            _ydocs[file_node.id] = doc
            _locks[file_node.id] = threading.Lock()
        return _ydocs[file_node.id]


def encode_state_as_update(doc):
    """Return the full document state as a Yjs binary update (bytes)."""
    if y_py_pkg is None:
        raise RuntimeError("y_py is not installed")
    return y_py_pkg.encode_state_as_update(doc)


def apply_update(doc, update_bytes):
    """Apply a binary update to the YDoc."""
    if y_py_pkg is None:
        raise RuntimeError("y_py is not installed")
    return y_py_pkg.apply_update(doc, update_bytes)


def checkpoint(file_node):
    """Persist the YDoc state back to the database as plaintext and update last_synced_at."""
    with _global_lock:
        doc = _ydocs.get(file_node.id)
        if doc is None:
            return
    # Read YText content
    with _locks[file_node.id]:
        try:
            ytext = doc.get_text("content")
            # y_py YText provides to_string() or str() depending on version
            try:
                content = ytext.to_string()
            except Exception:
                content = str(ytext)
        except Exception:
            content = ""

    # Persist to DB
    file_node.content = content
    file_node.version += 1
    file_node.last_synced_at = timezone.now()
    file_node.save(update_fields=["content", "version", "updated_at", "last_synced_at"])


def schedule_checkpoint(file_node, delay=5.0):
    """Debounce checkpoint writes — coalesce rapid edits into one DB write (threading.Timer).

    This is intentionally implemented with threading.Timer to work from both sync and
    async contexts within Channels consumers.
    """
    with _global_lock:
        existing = _checkpoint_timers.get(file_node.id)
        if existing is not None:
            existing.cancel()

        timer = threading.Timer(delay, _do_checkpoint, args=[file_node.id])
        timer.daemon = True
        _checkpoint_timers[file_node.id] = timer
        timer.start()


def _do_checkpoint(file_node_id):
    from .models import FileNode

    with _global_lock:
        _checkpoint_timers.pop(file_node_id, None)

    try:
        file_node = FileNode.objects.get(id=file_node_id)
        checkpoint(file_node)
    except FileNode.DoesNotExist:
        pass


def close_doc(file_node_id):
    with _global_lock:
        _ydocs.pop(file_node_id, None)
        lock = _locks.pop(file_node_id, None)
        timer = _checkpoint_timers.pop(file_node_id, None)
        if timer is not None:
            timer.cancel()
