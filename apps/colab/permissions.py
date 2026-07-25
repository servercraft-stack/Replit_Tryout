from rest_framework import permissions

from .models import WorkspaceMember


class IsWorkspaceMember(permissions.BasePermission):
    """Allow access only to members of the object's workspace."""

    def has_object_permission(self, request, view, obj):
        workspace = self._get_workspace(obj)
        if workspace is None:
            return False
        return WorkspaceMember.objects.filter(
            workspace=workspace,
            user=request.user,
        ).exists()

    def _get_workspace(self, obj):
        if hasattr(obj, "workspace"):
            return obj.workspace
        if hasattr(obj, "project"):
            return obj.project.workspace
        return None


class IsWorkspaceEditor(permissions.BasePermission):
    """Allow access only to editors or above in the object's workspace."""

    def has_object_permission(self, request, view, obj):
        workspace = self._get_workspace(obj)
        if workspace is None:
            return False
        try:
            membership = WorkspaceMember.objects.get(
                workspace=workspace,
                user=request.user,
            )
            return membership.has_at_least(WorkspaceMember.Role.EDITOR)
        except WorkspaceMember.DoesNotExist:
            return False

    def _get_workspace(self, obj):
        if hasattr(obj, "workspace"):
            return obj.workspace
        if hasattr(obj, "project"):
            return obj.project.workspace
        return None


class IsWorkspaceAdmin(permissions.BasePermission):
    """Allow access only to admins or above in the object's workspace."""

    def has_object_permission(self, request, view, obj):
        workspace = self._get_workspace(obj)
        if workspace is None:
            return False
        try:
            membership = WorkspaceMember.objects.get(
                workspace=workspace,
                user=request.user,
            )
            return membership.has_at_least(WorkspaceMember.Role.ADMIN)
        except WorkspaceMember.DoesNotExist:
            return False

    def _get_workspace(self, obj):
        if hasattr(obj, "workspace"):
            return obj.workspace
        if hasattr(obj, "project"):
            return obj.project.workspace
        return None


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow only the workspace owner or an admin."""

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "user"):
            # WorkspaceMember — allow self-edit or admin
            if obj.user == request.user:
                return True
            return WorkspaceMember.objects.filter(
                workspace=obj.workspace,
                user=request.user,
                role__in=[WorkspaceMember.Role.OWNER, WorkspaceMember.Role.ADMIN],
            ).exists()

        workspace = getattr(obj, "workspace", None)
        if workspace and workspace.owner_id == request.user.id:
            return True

        return False
