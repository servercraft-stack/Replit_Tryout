"""
Cross-platform code execution engine.

Runs user code in isolated temp files, captures output, cleans up.
Supports Python, JavaScript, C, C++, Java, Go, Rust, Ruby, Bash.
"""

import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

CURRENT_OS = platform.system()  # 'Windows', 'Darwin', 'Linux'

# ---------------------------------------------------------------------------
# Language configurations
# ---------------------------------------------------------------------------

def _which(cmd):
    """Return the full path to a command, or None."""
    return shutil.which(cmd)


LANG_CONFIGS = {
    "python": {
        "ext": ".py",
        "commands": {
            "Windows": ["python"],
            "Darwin": ["python3"],
            "Linux": ["python3"],
        },
        "compile": None,
    },
    "javascript": {
        "ext": ".js",
        "commands": {
            "Windows": ["node"],
            "Darwin": ["node"],
            "Linux": ["node"],
        },
        "compile": None,
    },
    "c": {
        "ext": ".c",
        "commands": {
            "Windows": ["gcc"],
            "Darwin": ["gcc"],
            "Linux": ["gcc"],
        },
        "compile": lambda out: ["gcc", "{file}", "-o", out, "-lm"],
        "run": lambda out: [out],
    },
    "cpp": {
        "ext": ".cpp",
        "commands": {
            "Windows": ["g++"],
            "Darwin": ["g++"],
            "Linux": ["g++"],
        },
        "compile": lambda out: ["g++", "{file}", "-o", out, "-std=c++17"],
        "run": lambda out: [out],
    },
    "java": {
        "ext": ".java",
        "commands": {
            "Windows": ["javac"],
            "Darwin": ["javac"],
            "Linux": ["javac"],
        },
        "compile": lambda out: ["javac", "{file}"],
        "run": lambda out: ["java", "-cp", str(Path(out).parent), Path(out).stem],
    },
    "go": {
        "ext": ".go",
        "commands": {
            "Windows": ["go"],
            "Darwin": ["go"],
            "Linux": ["go"],
        },
        "compile": None,
        "run_cmd": lambda: ["go", "run"],
    },
    "rust": {
        "ext": ".rs",
        "commands": {
            "Windows": ["rustc"],
            "Darwin": ["rustc"],
            "Linux": ["rustc"],
        },
        "compile": lambda out: ["rustc", "{file}", "-o", out],
        "run": lambda out: [out],
    },
    "ruby": {
        "ext": ".rb",
        "commands": {
            "Windows": ["ruby"],
            "Darwin": ["ruby"],
            "Linux": ["ruby"],
        },
        "compile": None,
    },
    "bash": {
        "ext": ".sh",
        "commands": {
            "Windows": ["bash"],
            "Darwin": ["bash"],
            "Linux": ["bash"],
        },
        "compile": None,
    },
}

# Timeout per language (seconds)
TIMEOUTS = {
    "python": 10,
    "javascript": 10,
    "c": 10,
    "cpp": 10,
    "java": 15,
    "go": 15,
    "rust": 15,
    "ruby": 10,
    "bash": 10,
}

# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

def get_available_languages():
    """Return list of languages whose interpreters/compilers are installed."""
    available = []
    for lang, config in LANG_CONFIGS.items():
        cmd = config["commands"].get(CURRENT_OS, [])
        if cmd and _which(cmd[0]):
            available.append(lang)
    return available


def execute_code(language, code, stdin=""):
    """
    Execute code in the given language and return the result.

    Args:
        language: One of the supported language keys.
        code: Source code string.
        stdin: Optional stdin input.

    Returns:
        dict with keys: output, error, exit_code, language, timed_out
    """
    language = language.lower().strip()

    if language not in LANG_CONFIGS:
        return {
            "output": "",
            "error": f"Unsupported language: {language}",
            "exit_code": 1,
            "language": language,
            "timed_out": False,
        }

    config = LANG_CONFIGS[language]
    ext = config["ext"]
    os_commands = config["commands"]
    cmd_list = os_commands.get(CURRENT_OS)

    if not cmd_list or not _which(cmd_list[0]):
        return {
            "output": "",
            "error": f"'{cmd_list[0]}' is not installed or not in PATH.",
            "exit_code": 1,
            "language": language,
            "timed_out": False,
        }

    timeout = TIMEOUTS.get(language, 10)
    use_shell = CURRENT_OS == "Windows"

    # For Go, use `go run <file>` directly
    if language == "go":
        return _run_go(code, stdin, timeout)

    # Create temp file
    tmp_dir = Path(tempfile.gettempdir()) / "streams_exec"
    tmp_dir.mkdir(exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(suffix=ext, dir=str(tmp_dir))
    tmp_path = Path(tmp_path)

    try:
        # Write code
        with os.fdopen(fd, "w") as f:
            f.write(code)

        # For compiled languages, compile first
        if config.get("compile"):
            out_path = str(tmp_path.with_suffix(""))
            if CURRENT_OS == "Windows":
                out_path += ".exe"

            compile_cmd = config["compile"](out_path)
            compile_cmd = [c.replace("{file}", str(tmp_path)) for c in compile_cmd]

            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                shell=use_shell,
                timeout=timeout,
            )

            if compile_result.returncode != 0:
                return {
                    "output": "",
                    "error": compile_result.stderr or compile_result.stdout or "Compilation failed.",
                    "exit_code": compile_result.returncode,
                    "language": language,
                    "timed_out": False,
                }

            # Run the compiled binary
            run_cmd = config["run"](out_path)
        else:
            # Interpreted: run directly
            run_cmd = cmd_list + [str(tmp_path)]

        # Execute
        result = subprocess.run(
            run_cmd,
            capture_output=True,
            text=True,
            input=stdin,
            shell=use_shell,
            timeout=timeout,
        )

        return {
            "output": result.stdout,
            "error": result.stderr,
            "exit_code": result.returncode,
            "language": language,
            "timed_out": False,
        }

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": f"Execution timed out after {timeout} seconds.",
            "exit_code": 124,
            "language": language,
            "timed_out": True,
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": f"Interpreter for '{language}' not found. Is it installed?",
            "exit_code": 1,
            "language": language,
            "timed_out": False,
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"Unexpected error: {str(e)}",
            "exit_code": 1,
            "language": language,
            "timed_out": False,
        }
    finally:
        # Cleanup temp files
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        # Cleanup compiled binaries
        if config.get("compile"):
            out_path = str(tmp_path.with_suffix(""))
            if CURRENT_OS == "Windows":
                out_path += ".exe"
            try:
                Path(out_path).unlink(missing_ok=True)
            except OSError:
                pass


def _run_go(code, stdin, timeout):
    """Run Go code using `go run` with a temp file."""
    tmp_dir = Path(tempfile.gettempdir()) / "streams_exec"
    tmp_dir.mkdir(exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(suffix=".go", dir=str(tmp_dir))
    try:
        with os.fdopen(fd, "w") as f:
            # Wrap in main package if not already
            if "package main" not in code:
                code = "package main\n\n" + code
            if "func main()" not in code:
                code = code + "\n\nfunc main() {}"
            f.write(code)

        cmd = ["go", "run", str(tmp_path)]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input=stdin,
            timeout=timeout,
        )
        return {
            "output": result.stdout,
            "error": result.stderr,
            "exit_code": result.returncode,
            "language": "go",
            "timed_out": False,
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": f"Execution timed out after {timeout} seconds.",
            "exit_code": 124,
            "language": "go",
            "timed_out": True,
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": "'go' is not installed or not in PATH.",
            "exit_code": 1,
            "language": "go",
            "timed_out": False,
        }
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass
