import logging

from celery import shared_task
from django.conf import settings

from .sandbox import get_manager

logger = logging.getLogger(__name__)


@shared_task
def reap_idle_terminal_sessions():
    timeout = getattr(settings, "TERMINAL_SANDBOX_IDLE_TIMEOUT", 1800)
    manager = get_manager()
    try:
        manager.reap_idle(timeout=timeout)
    except Exception as exc:
        logger.exception("Failed to reap idle terminal sessions: %s", exc)
