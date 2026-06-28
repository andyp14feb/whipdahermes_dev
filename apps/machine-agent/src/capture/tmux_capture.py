import logging
import subprocess

logger = logging.getLogger(__name__)


def capture_panes() -> list[dict]:
    """Discover all tmux panes and capture their visible text.

    Returns a list of raw pane captures with target identifier, text, and cwd.
    On any tmux error (not installed, no sessions), logs and returns empty list.
    """
    try:
        result = subprocess.run(
            ["tmux", "list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        logger.error("Failed to list tmux panes: %s", exc)
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
                ["tmux", "capture-pane", "-t", target, "-p"],
                capture_output=True,
                text=True,
                check=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            logger.error("Failed to capture pane %s: %s", target, exc)
            continue

        panes.append({"target": target, "text": capture.stdout, "cwd": cwd.strip() or None})

    return panes
