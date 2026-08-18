from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AcceptInvitationView,
    AvailableLanguagesView,
    CodeExecutionView,
    CollaborationEventViewSet,
    ColumnViewSet,
    FileNodeViewSet,
    InvitationViewSet,
    ProjectViewSet,
    TerminalSessionViewSet,
    WorkspaceMemberViewSet,
    WorkspaceViewSet,
)

router = DefaultRouter()
router.register("workspaces", WorkspaceViewSet, basename="workspace")
router.register("columns", ColumnViewSet, basename="column")
router.register("events", CollaborationEventViewSet, basename="event")
router.register("projects", ProjectViewSet, basename="project")
router.register("files", FileNodeViewSet, basename="file")
router.register("terminals", TerminalSessionViewSet, basename="terminal")
router.register("invitations", InvitationViewSet, basename="invitation")

# Nested routes
workspace_members = WorkspaceMemberViewSet.as_view({
    "get": "list",
    "post": "create",
})
workspace_members_detail = WorkspaceMemberViewSet.as_view({
    "get": "retrieve",
    "put": "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    path("execute/", CodeExecutionView.as_view(), name="code-execute"),
    path("languages/", AvailableLanguagesView.as_view(), name="available-languages"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="invitation-accept"),
    path(
        "workspaces/<uuid:workspace_pk>/members/",
        workspace_members,
        name="workspace-members-list",
    ),
    path(
        "workspaces/<uuid:workspace_pk>/members/<uuid:pk>/",
        workspace_members_detail,
        name="workspace-members-detail",
    ),
    path("", include(router.urls)),
]
