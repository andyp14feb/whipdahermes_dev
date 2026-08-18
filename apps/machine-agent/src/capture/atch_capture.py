from __future__ import annotations

import logging
import re
import subprocess

logger = logging.getLogger(__name__)

ATCH_SUBPROCESS_TIMEOUT_SECONDS = 5
ATCH_TAIL_LINES = 200
_STATUS_SUFFIX = re.compile(r"\s+\[(?:attached|stale|exited)\]\s*$", re.IGNORECASE)


def _session_names(output: str) -> list[str]:
    """Extract names from `atch list` while tolerating its human-readable status suffix."""
    names: list[str] = []
    for line in output.splitlines():
        value = line.strip()
        if not value or value == "(no sessions)":
            continue
        value = _STATUS_SUFFIX.sub("", value).strip()
        if value:
            names.append(value.split(maxsplit=1)[0])
    return names


def capture_sessions() -> list[dict]:
    """List active atch sessions and capture a bounded persistent-log preview for each."""
    try:
        result = subprocess.run(
            ["atch", "list"], capture_output=True, text=True, check=True,
            timeout=ATCH_SUBPROCESS_TIMEOUT_SECONDS,
        )
    except FileNotFoundError:
        logger.warning("atch sessions unavailable: atch binary not found")
        return []
    except subprocess.TimeoutExpired:
        logger.warning("atch sessions unavailable: command timed out after %ss", ATCH_SUBPROCESS_TIMEOUT_SECONDS)
        return []
    except subprocess.CalledProcessError as exc:
        logger.warning("atch sessions unavailable: %s", (exc.stderr or "").strip() or exc)
        return []

    sessions: list[dict] = []
    for name in _session_names(result.stdout):
        try:
            tail = subprocess.run(
                ["atch", "tail", "-n", str(ATCH_TAIL_LINES), name],
                capture_output=True, text=True, check=True,
                timeout=ATCH_SUBPROCESS_TIMEOUT_SECONDS,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.CalledProcessError) as exc:
            logger.warning("Failed to capture atch session %s: %s", name, exc)
            continue
        sessions.append({"backend": "atch", "target": name, "label": name, "text": tail.stdout, "cwd": None})
    return sessions
