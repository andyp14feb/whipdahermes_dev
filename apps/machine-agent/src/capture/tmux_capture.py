import logging
import subprocess
from pathlib import Path

from capture.tmux_command import build_tmux_command

logger = logging.getLogger(__name__)


def _socket_missing(tmux_socket: str | None) -> bool:
    return bool(tmux_socket and not Path(tmux_socket).exists())


def _format_tmux_error(exc: FileNotFoundError | subprocess.CalledProcessError, tmux_socket: str | None) -> str:
    if isinstance(exc, FileNotFoundError):
        return "tmux binary not found"
    stderr = (exc.stderr or "").strip()
    if _socket_missing(tmux_socket):
        return f"tmux socket unavailable at {tmux_socket}"
    return stderr or f"tmux exited with status {exc.returncode}"


def capture_panes(tmux_socket: str | None = None) -> list[dict]:
    """Discover all tmux panes and capture their visible text.

    Returns a list of raw pane captures with target identifier, text, and cwd.
    On any tmux error (not installed, no sessions), logs a concise warning and returns empty list.
    """
    try:
        result = subprocess.run(
            build_tmux_command(
                ["list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"],
                tmux_socket,
            ),
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        logger.warning("tmux panes unavailable: %s", _format_tmux_error(exc, tmux_socket))
        return []

    panes: list[dict] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue

        target, _, cwd = line.partition("\t")
        target = target.strip()
        if not target:
            continue

        try:
            capture = subprocess.run(
                build_tmux_command(["capture-pane", "-t", target, "-p"], tmux_socket),
                capture_output=True,
                text=True,
                check=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            logger.error("Failed to capture pane %s: %s", target, exc)
            continue

        panes.append({"target": target, "text": capture.stdout, "cwd": cwd.strip() or None})

    return panes
