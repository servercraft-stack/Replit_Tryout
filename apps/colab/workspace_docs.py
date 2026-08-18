import asyncio

import y_py

from .storage import workspace_object_storage


_documents = {}
_locks = {}


def lock(file_id):
    if file_id not in _locks:
        _locks[file_id] = asyncio.Lock()
    return _locks[file_id]


async def open_document(file_node):
    file_id = str(file_node.id)
    document = _documents.get(file_id)
    if document is not None:
        return document
    document = y_py.YDoc()
    source = await workspace_object_storage.aread_text(file_node.storage_key)
    with document.begin_transaction() as transaction:
        document.get_text("content").insert(transaction, 0, source)
    _documents[file_id] = document
    return document


async def save_document(file_node, document):
    source = document.get_text("content").to_json()
    import json

    await workspace_object_storage.awrite_text(file_node.storage_key, json.loads(source))
