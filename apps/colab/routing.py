from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/pair/(?P<token>[0-9a-f-]{36})/editor/$", consumers.EditorConsumer.as_asgi()),
    re_path(r"ws/pair/(?P<token>[0-9a-f-]{36})/terminal/$", consumers.TerminalConsumer.as_asgi()),
    re_path(
        r"ws/colab/boards/(?P<board_id>\d+)/$",
        consumers.BoardConsumer.as_asgi(),
    ),
    re_path(
        r"ws/colab/files/(?P<file_id>\d+)/$",
        consumers.WorkspaceEditorConsumer.as_asgi(),
    ),
    re_path(
        r"ws/colab/terminal/(?P<session_id>\d+)/$",
        consumers.WorkspaceTerminalConsumer.as_asgi(),
    ),
]
