import logging
import subprocess

from capture.tmux_command import build_tmux_command

logger = logging.getLogger(__name__)


def extract_cwd(target: str, tmux_socket: str | None = None) -> str | None:
    """Extract the current working directory of a tmux pane.

    Returns the cwd path, or None on failure (cwd is optional context).
    """
    try:
        result = subprocess.run(
            build_tmux_command(["display-message", "-t", target, "-p", "#{pane_current_path}"], tmux_socket),
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip() or None
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        logger.warning("Failed to extract cwd for %s: %s", target, exc)
        return None


def extract_label(target: str) -> str:
    """Extract the session name (label) from a tmux target string.

    Target format: "session_name:window.pane"
    Returns the session_name portion.
    """
    return target.split(":")[0]
