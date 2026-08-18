import secrets
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Invitation, WorkspaceMember

logger = logging.getLogger(__name__)


def generate_invite_token():
    return secrets.token_urlsafe(48)


def send_invitation_email(invitation):
    """Send an invitation email with an acceptance link."""
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    # Authenticated users accept invitations from the in-app Inbox. This avoids
    # exposing a one-click token URL that the frontend does not have to render.
    accept_url = f"{frontend_url}/inbox"

    subject = f"You've been invited to {invitation.workspace.name}"
    context = {
        "invited_by": invitation.invited_by.get_full_name() or invitation.invited_by.email,
        "workspace_name": invitation.workspace.name,
        "role": invitation.get_role_display(),
        "accept_url": accept_url,
    }

    try:
        html_message = render_to_string("emails/invitation.html", context)
    except Exception:
        html_message = (
            f"<p>You've been invited to join <strong>{invitation.workspace.name}</strong>.</p>"
            f"<p>Role: {invitation.get_role_display()}</p>"
            f"<p><a href='{accept_url}'>Click here to accept</a></p>"
        )

    email = EmailMessage(
        subject=subject,
        body=html_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", settings.EMAIL_HOST_USER),
        to=[invitation.email],
    )
    email.content_subtype = "html"
    # An in-app invitation must not be lost merely because SMTP is temporarily
    # unavailable. The Inbox is the primary delivery mechanism; email is a
    # notification channel and can be retried separately.
    try:
        email.send(fail_silently=False)
    except Exception:
        logger.exception("Could not send invitation email for invitation %s", invitation.id)


def create_invitation(workspace, email, invited_by, role=WorkspaceMember.Role.EDITOR):
    """Create an invitation and send the email."""
    token = generate_invite_token()
    invitation = Invitation.objects.create(
        workspace=workspace,
        email=email.lower().strip(),
        invited_by=invited_by,
        role=role,
        token=token,
    )
    send_invitation_email(invitation)
    return invitation


def accept_invitation(token, user):
    """Accept an invitation: create membership, update invitation status."""
    try:
        invitation = Invitation.objects.select_related("workspace").get(
            token=token,
            status=Invitation.Status.PENDING,
        )
    except Invitation.DoesNotExist:
        return None, "Invalid or expired invitation."

    if invitation.email.lower() != user.email.lower():
        return None, "This invitation was sent to a different email address."

    if timezone.now() > invitation.created_at + timezone.timedelta(days=7):
        invitation.status = Invitation.Status.EXPIRED
        invitation.save(update_fields=["status"])
        return None, "This invitation has expired."

    membership, created = WorkspaceMember.objects.get_or_create(
        workspace=invitation.workspace,
        user=user,
        defaults={"role": invitation.role},
    )
    if not created:
        # Already a member — just update role if higher
        if WorkspaceMember.ROLE_RANK[invitation.role] > WorkspaceMember.ROLE_RANK[membership.role]:
            membership.role = invitation.role
            membership.save(update_fields=["role"])

    invitation.status = Invitation.Status.ACCEPTED
    invitation.save(update_fields=["status"])

    return invitation.workspace, None
