from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.user.models import User


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket connections via JWT token in query string.

    Usage: ws://host/ws/colab/boards/1/?token=<access-token>
    """

    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope.get("query_string", b"").decode())
        token_list = query_string.get("token", [])

        if token_list:
            scope["user"] = await self._authenticate(token_list[0])
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def _authenticate(self, token):
        try:
            access_token = AccessToken(token)
            user_id = access_token["user_id"]
            return User.objects.get(id=user_id, is_active=True)
        except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
            return AnonymousUser()
