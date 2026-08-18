from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

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

User = get_user_model()


# ---------------------------------------------------------------------------
# User (read-only, for embedding in other serializers)
# ---------------------------------------------------------------------------

class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class WorkspaceSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    member_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Workspace
        fields = ["id", "name", "owner", "owner_name", "member_count", "created_at", "updated_at"]
        read_only_fields = ["owner", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        workspace = super().create(validated_data)
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=workspace.owner,
            role=WorkspaceMember.Role.OWNER,
        )
        return workspace


# ---------------------------------------------------------------------------
# Workspace Member
# ---------------------------------------------------------------------------

class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user_detail = UserSummarySerializer(source="user", read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ["id", "workspace", "user", "user_detail", "role", "created_at"]
        read_only_fields = ["created_at"]


# ---------------------------------------------------------------------------
# Column (defined before Board so BoardDetailSerializer can reference it)
# ---------------------------------------------------------------------------

class ColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = Column
        fields = ["id", "board", "title", "position", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

class BoardSerializer(serializers.ModelSerializer):
    column_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Board
        fields = ["id", "workspace", "title", "column_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class BoardDetailSerializer(BoardSerializer):
    columns = serializers.SerializerMethodField()

    class Meta(BoardSerializer.Meta):
        fields = BoardSerializer.Meta.fields + ["columns"]

    @extend_schema_field(field=ColumnSerializer(many=True))
    def get_columns(self, obj):
        columns = obj.columns.prefetch_related("cards").all()
        return ColumnSerializer(columns, many=True).data


# ---------------------------------------------------------------------------
# Card
# ---------------------------------------------------------------------------

class CardSerializer(serializers.ModelSerializer):
    updated_by_detail = UserSummarySerializer(source="updated_by", read_only=True)

    class Meta:
        model = Card
        fields = [
            "id", "column", "title", "body", "position",
            "version", "updated_by", "updated_by_detail",
            "created_at", "updated_at",
        ]
        read_only_fields = ["version", "updated_by", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "workspace", "name", "description", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class ProjectDetailSerializer(ProjectSerializer):
    file_count = serializers.IntegerField(read_only=True, default=0)
    terminal_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ["file_count", "terminal_count"]


# ---------------------------------------------------------------------------
# File Node
# ---------------------------------------------------------------------------

class FileNodeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    language = serializers.ReadOnlyField()
    icon = serializers.ReadOnlyField()
    node_type = serializers.SerializerMethodField()

    class Meta:
        model = FileNode
        fields = [
            "id", "project", "parent", "name", "node_type", "is_directory",
            "language", "icon", "storage_key", "version", "updated_by",
            "children", "created_at", "updated_at",
        ]
        read_only_fields = ["node_type", "storage_key", "version", "updated_by", "created_at", "updated_at"]

    def get_node_type(self, obj):
        return obj.node_type

    @extend_schema_field(field=serializers.ListSerializer(child=serializers.DictField()))
    def get_children(self, obj):
        if obj.node_type != FileNode.NodeType.DIRECTORY:
            return None
        children = obj.children.order_by("-is_directory", "name")
        return FileNodeSerializer(children, many=True).data


class FileNodeCreateSerializer(serializers.ModelSerializer):
    node_type = serializers.ChoiceField(choices=FileNode.NodeType.choices, write_only=True)
    content = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = FileNode
        fields = ["id", "project", "parent", "name", "node_type", "content"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        node_type = validated_data.pop("node_type")
        validated_data.pop("content", None)
        validated_data["is_directory"] = node_type == FileNode.NodeType.DIRECTORY
        return super().create(validated_data)


class FileContentSerializer(serializers.Serializer):
    """Response shape for object-store backed file content."""
    id = serializers.UUIDField(read_only=True)
    content = serializers.CharField(required=False, allow_blank=True)
    version = serializers.IntegerField(read_only=True)


# ---------------------------------------------------------------------------
# Terminal Session
# ---------------------------------------------------------------------------

class TerminalSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerminalSession
        fields = ["id", "project", "user", "name", "shell_type", "pid", "status", "created_at", "updated_at"]
        read_only_fields = ["user", "pid", "status", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Collaboration Event (read-only audit trail)
# ---------------------------------------------------------------------------

class CollaborationEventSerializer(serializers.ModelSerializer):
    actor_detail = UserSummarySerializer(source="actor", read_only=True)

    class Meta:
        model = CollaborationEvent
        fields = [
            "id", "workspace", "board", "actor", "actor_detail",
            "event_type", "payload", "entity_type", "entity_id",
            "entity_version", "created_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Invitation
# ---------------------------------------------------------------------------

class InvitationSerializer(serializers.ModelSerializer):
    invited_by_detail = UserSummarySerializer(source="invited_by", read_only=True)
    workspace_name = serializers.CharField(source="workspace.name", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id", "workspace", "workspace_name", "email", "invited_by",
            "invited_by_detail", "role", "status", "token",
            "created_at", "updated_at",
        ]
        read_only_fields = ["invited_by", "token", "status", "created_at", "updated_at"]

    def validate_email(self, value):
        return value.lower().strip()


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=WorkspaceMember.Role.choices,
        default=WorkspaceMember.Role.EDITOR,
    )
