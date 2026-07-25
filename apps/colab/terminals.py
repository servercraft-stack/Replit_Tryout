import os
import pty
import select
import signal
import struct
import fcntl
import termios

_sessions: dict[int, dict] = {}

SHELL_COMMANDS = {
    "bash": ["bash"],
    "python": ["python3", "-i", "-u"],
}


def open_shell(project_id, shell_type="bash") -> int:
    if project_id not in _sessions:
        cmd = SHELL_COMMANDS.get(shell_type, SHELL_COMMANDS["bash"])
        pid, master_fd = pty.fork()
        if pid == 0:
            # Child process
            os.execvp(cmd[0], cmd)
        _sessions[project_id] = {"pid": pid, "master_fd": master_fd}
    return _sessions[project_id]["master_fd"]


def close_shell(project_id):
    session = _sessions.pop(project_id, None)
    if session:
        try:
            os.kill(session["pid"], signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            os.close(session["master_fd"])
        except OSError:
            pass


def resize_terminal(project_id, cols, rows):
    session = _sessions.get(project_id)
    if session is None:
        return
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(session["master_fd"], termios.TIOCSWINSZ, winsize)
