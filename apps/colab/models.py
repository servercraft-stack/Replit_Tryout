from django.conf import settings
from django.db import models


EXTENSION_MAP = {
    "py": "python",
    "js": "javascript",
    "jsx": "javascript",
    "ts": "typescript",
    "tsx": "typescript",
    "html": "html",
    "htm": "html",
    "css": "css",
    "scss": "css",
    "json": "json",
    "md": "markdown",
    "yaml": "yaml",
    "yml": "yaml",
    "toml": "toml",
    "sh": "bash",
    "bash": "bash",
    "sql": "sql",
    "xml": "xml",
    "java": "java",
    "go": "go",
    "rs": "rust",
    "rb": "ruby",
    "php": "php",
    "c": "c",
    "cpp": "cpp",
    "h": "c",
    "hpp": "cpp",
    "cs": "csharp",
    "swift": "swift",
    "kt": "kotlin",
    "r": "r",
    "dockerfile": "dockerfile",
    "txt": "text",
    "env": "env",
    "gitignore": "gitignore",
}



class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Workspace(TimestampedModel):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_workspaces",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class WorkspaceMember(TimestampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    ROLE_RANK = {
        Role.VIEWER: 0,
        Role.EDITOR: 1,
        Role.ADMIN: 2,
        Role.OWNER: 3,
    }

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="unique_workspace_member",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "user"]),
        ]

    def __str__(self):
        return f"{self.user} @ {self.workspace} ({self.role})"

    def has_at_least(self, role):
        return self.ROLE_RANK[self.role] >= self.ROLE_RANK[role]


class Board(TimestampedModel):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="boards",
    )
    title = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.workspace})"


class Column(TimestampedModel):
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="columns",
    )
    title = models.CharField(max_length=255)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["board", "position"]
        indexes = [
            models.Index(fields=["board", "position"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.board})"


class Card(TimestampedModel):
    column = models.ForeignKey(
        Column,
        on_delete=models.CASCADE,
        related_name="cards",
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default="")
    position = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_cards",
    )

    class Meta:
        ordering = ["column", "position"]
        indexes = [
            models.Index(fields=["column", "position"]),
        ]

    def __str__(self):
        return self.title


class Project(TimestampedModel):
    """A code/document project inside a workspace."""
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.workspace})"


class FileNode(TimestampedModel):
    """A file or directory in a project's virtual filesystem."""

    class NodeType(models.TextChoices):
        FILE = "file", "File"
        DIRECTORY = "dir", "Directory"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="file_nodes",
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    name = models.CharField(max_length=255)
    node_type = models.CharField(max_length=10, choices=NodeType.choices)
    content = models.TextField(blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_files",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "parent", "name"],
                name="unique_file_node_per_parent",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "parent"]),
        ]

    def __str__(self):
        return self.name

    @property
    def is_directory(self):
        return self.node_type == self.NodeType.DIRECTORY

    @property
    def language(self):
        """Detect language from file extension."""
        if self.is_directory:
            return None
        ext = self.name.rsplit(".", 1)[-1].lower() if "." in self.name else ""
        return EXTENSION_MAP.get(ext, None)

    @property
    def icon(self):
        """Return icon identifier for the file type."""
        lang = self.language
        if lang:
            return lang
        if self.is_directory:
            return "folder"
        return "file"


class TerminalSession(TimestampedModel):
    """Tracks a live terminal (PTY) session for a project."""

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        STOPPED = "stopped", "Stopped"

    class ShellType(models.TextChoices):
        BASH = "bash", "Bash"
        PYTHON = "python", "Python"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="terminal_sessions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="terminal_sessions",
    )
    name = models.CharField(max_length=100, default="Terminal")
    shell_type = models.CharField(
        max_length=20,
        choices=ShellType.choices,
        default=ShellType.BASH,
    )
    pid = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RUNNING,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.project})"


class CollaborationEvent(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="events",
    )
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="events",
        null=True,
        blank=True,
        help_text="Null for workspace-level events not scoped to one board.",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collaboration_events",
    )
    event_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Mirrors the WS event 'type', e.g. 'card.updated'.",
    )
    payload = models.JSONField(default=dict, blank=True)
    entity_type = models.CharField(max_length=50)
    entity_id = models.PositiveIntegerField()
    entity_version = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["board", "-created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.event_type} on {self.entity_type}:{self.entity_id}"


class Invitation(TimestampedModel):
    """Workspace invitation sent via email."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invitations",
    )
    role = models.CharField(
        max_length=20,
        choices=WorkspaceMember.Role.choices,
        default=WorkspaceMember.Role.EDITOR,
    )
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "status"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        return f"Invite {self.email} to {self.workspace}"