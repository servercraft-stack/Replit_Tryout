import os
import platform
import select
import shutil
import signal
import struct
from pathlib import Path

from django.conf import settings

if platform.system() != "Windows":
    import fcntl
    import pty
    import termios


_sessions = {}


def _get_shell_command(shell_type):
    if shell_type == "python":
        if platform.system() == "Windows":
            return ["python", "-i", "-u"]
        return ["python3", "-i", "-u"]

    if platform.system() == "Windows":
        bash_executable = os.getenv("BASH_EXECUTABLE")
        if not bash_executable:
            raise RuntimeError("Set BASH_EXECUTABLE in .env for Windows terminal support (e.g., C:\\Program Files\\Git\\bin\\bash.exe)")
        if not os.path.exists(bash_executable):
            raise RuntimeError(f"BASH_EXECUTABLE not found: {bash_executable}")
        return [bash_executable, "--noprofile", "--norc", "-i"]

    return ["bash", "--noprofile", "--norc", "-i"]


def get_project_dir(project_id):
    root = Path(settings.WORKSPACE_LOCAL_STORAGE_ROOT).resolve()
    project_path = root / f"projects/{project_id}"
    project_path.mkdir(parents=True, exist_ok=True)
    return str(project_path)


def open_shell(session_id, shell_type="bash", cwd=None):
    session = _sessions.get(session_id)
    if session is not None:
        return session
    working_dir = cwd or str(settings.BASE_DIR)
    if platform.system() == "Windows":
        try:
            from winpty import PtyProcess
        except ImportError as exc:
            raise RuntimeError("pywinpty is required for interactive Windows terminals.") from exc
        command = _get_shell_command(shell_type)
        process = PtyProcess.spawn(command, cwd=working_dir, env=dict(os.environ, TERM="xterm-256color"))
        session = {"backend": "windows", "process": process, "cwd": working_dir}
    else:
        pid, master_fd = pty.fork()
        if pid == 0:
            os.chdir(working_dir)
            os.environ["TERM"] = "xterm-256color"
            os.environ["COLORTERM"] = "truecolor"
            os.environ["PS1"] = "\\[\\e[1;34m\\]\\W\\[\\e[0m\\] $ "
            command = _get_shell_command(shell_type)
            os.execvp(command[0], command)
        session = {"backend": "unix", "pid": pid, "master_fd": master_fd, "cwd": working_dir}
    _sessions[session_id] = session
    return session


def write_shell(session_id, data):
    session = _sessions[session_id]
    if session["backend"] == "windows":
        session["process"].write(data)
    else:
        os.write(session["master_fd"], data.encode())


def read_shell(session_id, timeout=0.25):
    session = _sessions.get(session_id)
    if session is None:
        return None
    if session["backend"] == "windows":
        value = session["process"].readline()
        return value or None
    ready, _, _ = select.select([session["master_fd"]], [], [], timeout)
    if not ready:
        return None
    data = os.read(session["master_fd"], 4096)
    return data.decode("utf-8", errors="replace") if data else None


def close_shell(session_id):
    session = _sessions.pop(session_id, None)
    if session is None:
        return
    if session["backend"] == "windows":
        try:
            session["process"].terminate()
        except Exception:
            pass
        return
    try:
        os.kill(session["pid"], signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        os.close(session["master_fd"])
    except OSError:
        pass


def resize_terminal(session_id, cols, rows):
    session = _sessions.get(session_id)
    if session is None:
        return
    if session["backend"] == "windows":
        session["process"].set_size(int(cols), int(rows))
        return
    fcntl.ioctl(session["master_fd"], termios.TIOCSWINSZ, struct.pack("HHHH", int(rows), int(cols), 0, 0))
