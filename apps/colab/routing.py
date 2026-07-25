from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/colab/boards/(?P<board_id>\d+)/$",
        consumers.BoardConsumer.as_asgi(),
    ),
    re_path(
        r"ws/colab/files/(?P<file_id>\d+)/$",
        consumers.FileConsumer.as_asgi(),
    ),
    re_path(
        r"ws/colab/terminal/(?P<session_id>\d+)/$",
        consumers.TerminalConsumer.as_asgi(),
    ),
]
