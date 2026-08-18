"""Docker-backed sandboxed terminal sessions."""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from typing import Optional

import docker
import docker.errors
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_IMAGE = os.getenv("TERMINAL_SANDBOX_IMAGE", "docker.io/library/ubuntu:22.04")
DEFAULT_MEMORY = os.getenv("TERMINAL_SANDBOX_MEMORY", "512m")
DEFAULT_CPUS = float(os.getenv("TERMINAL_SANDBOX_CPUS", "1"))
DEFAULT_PIDS_LIMIT = int(os.getenv("TERMINAL_SANDBOX_PIDS_LIMIT", "64"))
DEFAULT_IDLE_TIMEOUT = int(os.getenv("TERMINAL_SANDBOX_IDLE_TIMEOUT", "1800"))
DEFAULT_COMMAND_TIMEOUT = int(os.getenv("TERMINAL_SANDBOX_COMMAND_TIMEOUT", "120"))

_SESSIONS: dict[str, "SandboxSession"] = {}
_LOCK = threading.Lock()


class SandboxSession:
    def __init__(self, session_id: str, container_id: str, client: docker.DockerClient):
        self.session_id = session_id
        self.container_id = container_id
        self.client = client
        self.container = client.containers.get(container_id)
        self.exec_id: Optional[str] = None
        self.sock = None
        self.output_thread: Optional[threading.Thread] = None
        self.command_queue: queue.Queue[str] = queue.Queue()
        self.last_active = time.time()
        self._stop = threading.Event()

    def start_shell(self):
        exec_obj = self.container.client.api.exec_create(
            self.container_id,
            cmd=["bash", "--noprofile", "--norc", "-i"],
            stdin=True,
            tty=True,
        )
        self.exec_id = exec_obj["Id"]
        raw_sock = self.container.client.api.exec_start(
            self.exec_id,
            stream=True,
            socket=True,
            demux=False,
        )
        self.sock = raw_sock
        self.output_thread = threading.Thread(target=self._read_output, daemon=True)
        self.output_thread.start()

    def _read_output(self):
        try:
            while not self._stop.is_set():
                chunk = self.sock.recv(4096)
                if not chunk:
                    break
                data = chunk.decode("utf-8", errors="replace")
                self.command_queue.put(data)
        except Exception:
            pass
        finally:
            try:
                self.sock.close()
            except Exception:
                pass

    def write(self, data: str):
        self.last_active = time.time()
        try:
            self.sock.sendall(data.encode("utf-8"))
        except Exception:
            pass

    def resize(self, cols: int, rows: int):
        try:
            self.container.client.api.exec_resize(self.exec_id, height=rows, width=cols)
        except Exception:
            pass

    def stop(self):
        self._stop.set()
        try:
            if self.sock:
                self.sock.close()
        except Exception:
            pass
        try:
            if self.exec_id:
                self.container.client.api.exec_inspect(self.exec_id)
        except Exception:
            pass
        try:
            self.container.kill()
        except docker.errors.NotFound:
            pass
        except Exception:
            pass
        try:
            self.container.remove()
        except docker.errors.NotFound:
            pass
        except Exception:
            pass


class ContainerManager:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                import docker
                self._client = docker.from_env()
                self._client.ping()
            except Exception as exc:
                raise RuntimeError(f"Docker is not available: {exc}") from exc
        return self._client

    def start_session(self, session_id: str, project_id: int) -> SandboxSession:
        with _LOCK:
            if session_id in _SESSIONS:
                existing = _SESSIONS[session_id]
                try:
                    existing.container.reload()
                    return existing
                except docker.errors.NotFound:
                    _SESSIONS.pop(session_id, None)

            workspace_root = os.path.abspath(
                str(settings.WORKSPACE_LOCAL_STORAGE_ROOT)
            )
            project_dir = os.path.join(workspace_root, "projects", str(project_id))
            os.makedirs(project_dir, exist_ok=True)
            volume_target = "/workspace"
            volumes = {workspace_root: {"bind": volume_target, "mode": "rw"}}

            container = self.client.containers.run(
                image=settings.TERMINAL_SANDBOX_IMAGE,
                command="sleep infinity",
                volumes=volumes,
                network_mode="none",
                mem_limit=str(settings.TERMINAL_SANDBOX_MEMORY),
                cpu_period=100000,
                cpu_quota=int(settings.TERMINAL_SANDBOX_CPUS * 100000),
                pids_limit=settings.TERMINAL_SANDBOX_PIDS_LIMIT,
                read_only=True,
                tmpfs={"/tmp": "rw,noexec,nosuid,size=64m"},
                detach=True,
                remove=True,
                auto_remove=True,
                working_dir=os.path.join(volume_target, "projects", str(project_id)),
                environment={
                    "TERM": "xterm-256color",
                    "COLORTERM": "truecolor",
                    "PS1": r"\e[1;34m\W\e[0m $ ",
                },
            )

            session = SandboxSession(session_id, container.id, self.client)
            session.start_shell()
            _SESSIONS[session_id] = session
            return session

    def get_session(self, session_id: str) -> Optional[SandboxSession]:
        with _LOCK:
            return _SESSIONS.get(session_id)

    def stop_session(self, session_id: str):
        with _LOCK:
            session = _SESSIONS.pop(session_id, None)
        if session is None:
            return
        session.stop()

    def reap_idle(self, timeout: int = DEFAULT_IDLE_TIMEOUT):
        cutoff = time.time() - timeout
        with _LOCK:
            dead = [sid for sid, s in _SESSIONS.items() if s.last_active < cutoff]
        for sid in dead:
            try:
                self.stop_session(sid)
            except Exception:
                pass


def get_manager() -> ContainerManager:
    if not hasattr(get_manager, "_instance"):
        get_manager._instance = ContainerManager()
    return get_manager._instance
