import json

import y_py

from .models import PairSession


_docs = {}


def get_doc(session):
    token = str(session.token)
    document = _docs.get(token)
    if document is None:
        document = y_py.YDoc()
        with document.begin_transaction() as transaction:
            document.get_text("code").insert(transaction, 0, session.code)
        _docs[token] = document
    return document


def encode_state(document):
    return y_py.encode_state_as_update(document)


def apply_update(document, update):
    y_py.apply_update(document, update)


def content(document):
    return json.loads(document.get_text("code").to_json())


def persist(token, document):
    PairSession.objects.filter(token=token).update(code=content(document))
