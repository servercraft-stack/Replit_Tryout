from django.db.models import Count
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .executor import execute_code, get_available_languages
from .invitations import accept_invitation, create_invitation
from .models import (
    Board,
    Card,
    CollaborationEvent,
    Column,
    FileNode,
    Invitation,
    Project,
    TerminalSession,
    Workspace,
    WorkspaceMember,
)
from .permissions import IsWorkspaceAdmin, IsWorkspaceEditor, IsWorkspaceMember
from .serializers import (
    BoardDetailSerializer,
    BoardSerializer,
    CardSerializer,
    CollaborationEventSerializer,
    ColumnSerializer,
    FileContentSerializer,
    FileNodeCreateSerializer,
    FileNodeSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    ProjectDetailSerializer,
    ProjectSerializer,
    TerminalSessionSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.none()
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Workspace.objects.none()
        return Workspace.objects.filter(
            members__user=self.request.user,
        ).annotate(
            member_count=Count("members", distinct=True),
        ).distinct()

    def get_permissions(self):
        if self.action in ("retrieve", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsWorkspaceAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


# ---------------------------------------------------------------------------
# Workspace Members
# ---------------------------------------------------------------------------

class WorkspaceMemberViewSet(viewsets.ModelViewSet):
    queryset = WorkspaceMember.objects.none()
    serializer_class = WorkspaceMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkspaceMember.objects.none()
        return WorkspaceMember.objects.filter(
            workspace_id=self.kwargs["workspace_pk"],
        ).select_related("user")

    def perform_create(self, serializer):
        serializer.save(workspace_id=self.kwargs["workspace_pk"])


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

class BoardViewSet(viewsets.ModelViewSet):
    queryset = Board.objects.none()
    serializer_class = BoardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Board.objects.none()
        qs = Board.objects.filter(
            workspace__members__user=self.request.user,
        )
        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)
        return qs.annotate(
            column_count=Count("columns", distinct=True),
        ).distinct()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BoardDetailSerializer
        return BoardSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsWorkspaceEditor()]
        return [permissions.IsAuthenticated()]


# ---------------------------------------------------------------------------
# Column
# ---------------------------------------------------------------------------

class ColumnViewSet(viewsets.ModelViewSet):
    queryset = Column.objects.none()
    serializer_class = ColumnSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Column.objects.none()
        qs = Column.objects.filter(
            board__workspace__members__user=self.request.user,
        )
        board_id = self.request.query_params.get("board") or self.kwargs.get("board_pk")
        if board_id:
            qs = qs.filter(board_id=board_id)
        return qs

    def perform_create(self, serializer):
        board_id = self.request.data.get("board") or self.kwargs.get("board_pk")
        serializer.save(board_id=board_id)


# ---------------------------------------------------------------------------
# Card
# ---------------------------------------------------------------------------

class CardViewSet(viewsets.ModelViewSet):
    queryset = Card.objects.none()
    serializer_class = CardSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Card.objects.none()
        qs = Card.objects.select_related(
            "column__board__workspace", "updated_by",
        ).filter(
            column__board__workspace__members__user=self.request.user,
        )
        column_id = self.request.query_params.get("column")
        if column_id:
            qs = qs.filter(column_id=column_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        instance.version += 1
        instance.save(update_fields=["version", "updated_at"])

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        card = self.get_object()
        new_column_id = request.data.get("column_id")
        new_position = request.data.get("position", 0)

        if new_column_id is None:
            return Response(
                {"detail": "column_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        card.column_id = new_column_id
        card.position = new_position
        card.version += 1
        card.save(update_fields=["column", "position", "version", "updated_at"])

        return Response(CardSerializer(card).data)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.none()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Project.objects.none()
        qs = Project.objects.filter(
            workspace__members__user=self.request.user,
        )
        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsWorkspaceEditor()]
        return [permissions.IsAuthenticated()]


# ---------------------------------------------------------------------------
# File Node
# ---------------------------------------------------------------------------

class FileNodeViewSet(viewsets.ModelViewSet):
    queryset = FileNode.objects.none()
    serializer_class = FileNodeSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FileNode.objects.none()
        qs = FileNode.objects.select_related("updated_by").filter(
            project__workspace__members__user=self.request.user,
        )
        project_id = self.request.query_params.get("project") or self.kwargs.get("project_pk")
        if project_id:
            qs = qs.filter(project_id=project_id)
        parent_id = self.request.query_params.get("parent")
        if parent_id == "null" or parent_id == "":
            qs = qs.filter(parent__isnull=True)
        elif parent_id:
            qs = qs.filter(parent_id=parent_id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return FileNodeCreateSerializer
        if self.action == "retrieve":
            if self.request.query_params.get("content") == "true":
                return FileContentSerializer
        return FileNodeSerializer

    def perform_create(self, serializer):
        project_id = self.request.data.get("project") or self.kwargs.get("project_pk")
        serializer.save(project_id=project_id, updated_by=self.request.user)

    @action(detail=True, methods=["get", "put", "patch"], url_path="content")
    def content(self, request, pk=None):
        file_node = self.get_object()
        if file_node.is_directory:
            return Response(
                {"detail": "Directories do not have content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == "GET":
            return Response({
                "id": file_node.id,
                "content": file_node.content,
                "version": file_node.version,
            })

        serializer = FileContentSerializer(file_node, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="diagnostics")
    def diagnostics(self, request, pk=None):
        """Run syntax diagnostics on a file's content."""
        file_node = self.get_object()
        if file_node.is_directory:
            return Response(
                {"errors": [], "warnings": []},
                status=status.HTTP_200_OK,
            )

        content = request.data.get("content", file_node.content)
        language = file_node.language
        errors = []
        warnings = []

        if language == "python":
            import ast
            import traceback
            try:
                ast.parse(content)
            except SyntaxError as e:
                errors.append({
                    "line": e.lineno or 1,
                    "column": e.offset or 0,
                    "message": e.msg,
                    "severity": "error",
                })

        elif language == "javascript":
            # Basic bracket/paren matching check
            stack = []
            pairs = {")": "(", "]": "[", "}": "{"}
            for i, ch in enumerate(content):
                if ch in "([{":
                    stack.append((ch, i))
                elif ch in ")]}":
                    if not stack or stack[-1][0] != pairs[ch]:
                        errors.append({
                            "line": content[:i].count("\n") + 1,
                            "column": i - content[:i].rfind("\n"),
                            "message": f"Unexpected '{ch}'",
                            "severity": "error",
                        })
                        break
                    stack.pop()

        elif language == "html":
            # Basic unclosed tag check
            import re
            tags = re.findall(r"<(/?)(\w+)", content)
            open_tags = []
            for closing, tag in tags:
                if not closing:
                    open_tags.append(tag)
                elif open_tags and open_tags[-1] == tag:
                    open_tags.pop()
            for tag in open_tags:
                warnings.append({
                    "line": 1,
                    "column": 0,
                    "message": f"Unclosed tag <{tag}>",
                    "severity": "warning",
                })

        return Response({"errors": errors, "warnings": warnings})


# ---------------------------------------------------------------------------
# Terminal Session
# ---------------------------------------------------------------------------

class TerminalSessionViewSet(viewsets.ModelViewSet):
    queryset = TerminalSession.objects.none()
    serializer_class = TerminalSessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TerminalSession.objects.none()
        qs = TerminalSession.objects.select_related("user", "project").filter(
            project__workspace__members__user=self.request.user,
        )
        project_id = self.request.query_params.get("project") or self.kwargs.get("project_pk")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        project_id = self.request.data.get("project") or self.kwargs.get("project_pk")
        serializer.save(user=self.request.user, project_id=project_id)


# ---------------------------------------------------------------------------
# Collaboration Events (read-only audit trail)
# ---------------------------------------------------------------------------

class CollaborationEventViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = CollaborationEvent.objects.none()
    serializer_class = CollaborationEventSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CollaborationEvent.objects.none()
        qs = CollaborationEvent.objects.select_related("actor").filter(
            workspace__members__user=self.request.user,
        )
        board_id = self.request.query_params.get("board")
        if board_id:
            qs = qs.filter(board_id=board_id)
        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        return qs


# ---------------------------------------------------------------------------
# Code Execution
# ---------------------------------------------------------------------------

class CodeExecutionView(APIView):
    """Execute code in a sandboxed environment."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        language = request.data.get("language")
        code = request.data.get("code")
        stdin = request.data.get("stdin", "")

        if not language or not code:
            return Response(
                {"detail": "Both 'language' and 'code' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = execute_code(language, code, stdin)
        return Response(result)


class AvailableLanguagesView(APIView):
    """List languages available on this server."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        languages = get_available_languages()
        return Response({"languages": languages})


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.none()
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()
        return Invitation.objects.select_related("workspace", "invited_by").filter(
            workspace__members__user=self.request.user,
        )

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), IsWorkspaceEditor()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        workspace_id = self.request.data.get("workspace")
        workspace = Workspace.objects.get(id=workspace_id)
        create_invitation(
            workspace=workspace,
            email=serializer.validated_data["email"],
            invited_by=self.request.user,
            role=serializer.validated_data.get("role", WorkspaceMember.Role.EDITOR),
        )

    @action(detail=False, methods=["get"], url_path="my")
    def my_invitations(self, request):
        """List invitations sent to the current user's email."""
        invitations = Invitation.objects.select_related("workspace", "invited_by").filter(
            email=request.user.email,
            status=Invitation.Status.PENDING,
        )
        serializer = InvitationSerializer(invitations, many=True)
        return Response(serializer.data)


class AcceptInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response(
                {"detail": "Token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace, error = accept_invitation(token, request.user)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Invitation accepted.",
            "workspace": {
                "id": str(workspace.id),
                "name": workspace.name,
            },
        })
