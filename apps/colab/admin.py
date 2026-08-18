from django.contrib import admin

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


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at")
    search_fields = ("name",)
    list_filter = ("created_at",)


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "workspace", "role", "created_at")
    list_filter = ("role",)


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ("title", "workspace", "created_at")
    list_filter = ("workspace",)


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    list_display = ("title", "board", "position")
    list_filter = ("board",)


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ("title", "column", "position", "version", "updated_by")
    list_filter = ("column",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "created_at")
    list_filter = ("workspace",)


@admin.register(FileNode)
class FileNodeAdmin(admin.ModelAdmin):
    list_display = ("name", "node_type", "project", "parent", "version", "updated_by")
    list_filter = ("is_directory", "project")


@admin.register(TerminalSession)
class TerminalSessionAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "user", "shell_type", "status", "pid")
    list_filter = ("status", "shell_type")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "workspace", "role", "status", "invited_by", "created_at")
    list_filter = ("status", "role")
    search_fields = ("email",)


@admin.register(CollaborationEvent)
class CollaborationEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "entity_type", "entity_id", "actor", "created_at")
    list_filter = ("event_type", "entity_type")
    readonly_fields = ("payload",)
