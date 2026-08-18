import os
import platform
import select
import signal
import subprocess
import threading
from dataclasses import dataclass, field
from typing import Union

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings


@dataclass
class Shell:
    process: Union[subprocess.Popen, "PtyProcess"]
    master_fd: Union[int, None]
    history: str = ""
    backend: str = "unix"


_shells = {}
_lock = threading.Lock()


def _group(token):
    return f"pair_terminal_{token}"


def _get_shell_command(shell_type="bash"):
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


def get_shell(token):
    with _lock:
        shell = _shells.get(token)
        if shell:
            if shell.backend == "unix" and shell.process.poll() is None:
                return shell
            if shell.backend == "windows":
                try:
                    if shell.process.isalive():
                        return shell
                except Exception:
                    pass

        if platform.system() == "Windows":
            try:
                from winpty import PtyProcess
            except ImportError as exc:
                raise RuntimeError("pywinpty is required for interactive Windows terminals.") from exc
            command = _get_shell_command()
            process = PtyProcess.spawn(command, cwd=str(settings.BASE_DIR), env=dict(os.environ, TERM="xterm-256color"))
            shell = Shell(process=process, master_fd=None, backend="windows")
        else:
            master_fd, slave_fd = pty.openpty()
            process = subprocess.Popen(
                _get_shell_command(),
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=settings.BASE_DIR,
                start_new_session=True,
                close_fds=True,
            )
            os.close(slave_fd)
            shell = Shell(process=process, master_fd=master_fd, backend="unix")

        _shells[token] = shell
        threading.Thread(target=_read_shell, args=(token, shell), daemon=True).start()
        return shell


def write_shell(token, data):
    shell = get_shell(token)
    if shell.backend == "windows":
        shell.process.write(data)
    else:
        os.write(shell.master_fd, data.encode())


def resize_shell(token, columns, rows):
    shell = get_shell(token)
    if shell.backend == "windows":
        shell.process.set_size(int(columns), int(rows))
    else:
        import fcntl
        import struct
        import termios

        fcntl.ioctl(shell.master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", int(rows), int(columns), 0, 0))


def output_history(token):
    return get_shell(token).history


def _read_shell(token, shell):
    layer = get_channel_layer()
    if shell.backend == "windows":
        while shell.process.isalive():
            try:
                data = shell.process.read()
                if data is None:
                    continue
                output = data if isinstance(data, str) else data.decode("utf-8", errors="replace")
                if not output:
                    continue
                shell.history = (shell.history + output)[-65536:]
                async_to_sync(layer.group_send)(_group(token), {"type": "terminal.output", "data": output})
            except Exception:
                break
    else:
        while shell.process.poll() is None:
            try:
                ready, _, _ = select.select([shell.master_fd], [], [], 0.25)
                if not ready:
                    continue
                data = os.read(shell.master_fd, 4096)
                if not data:
                    break
                output = data.decode("utf-8", errors="replace")
                shell.history = (shell.history + output)[-65536:]
                async_to_sync(layer.group_send)(_group(token), {"type": "terminal.output", "data": output})
            except OSError:
                break

    with _lock:
        if _shells.get(token) is shell:
            _shells.pop(token, None)

    if shell.backend == "unix":
        try:
            os.close(shell.master_fd)
        except OSError:
            pass


def stop_shell(token):
    with _lock:
        shell = _shells.pop(token, None)
    if shell is None:
        return
    if shell.backend == "windows":
        try:
            shell.process.terminate()
        except Exception:
            pass
    else:
        if shell.process.poll() is None:
            os.killpg(shell.process.pid, signal.SIGTERM)
        try:
            os.close(shell.master_fd)
        except OSError:
            pass
