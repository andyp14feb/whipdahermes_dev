from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from capture.context_extractor import extract_label
from parse.signals import compute_diff_pct, compute_stable_counter


@dataclass
class SessionSnapshot:
    session_id: str
    label: str
    preview: str
    cwd: str | None
    diff_pct: float
    stable_counter: int
    seconds_since_change: int
    captured_at: str


@dataclass
class CaptureState:
    previous_captures: dict[str, str] = field(default_factory=dict)
    previous_counters: dict[str, int] = field(default_factory=dict)


def _now_utc_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


PREVIEW_MAX_CHARS = 2000


def parse_sessions(
    panes: list[dict],
    state: CaptureState,
    interval: int = 1,
    threshold: float = 1.0,
) -> tuple[list[SessionSnapshot], CaptureState]:
    """Parse raw pane captures into structured SessionSnapshot objects.

    Pure function w.r.t. tmux — no subprocess calls, receives pre-captured data.

    Args:
        panes: List of dicts with "target" and "text" keys.
        state: Previous capture state for diff computation.
        interval: Seconds per stable_counter tick (default 1).
        threshold: diff_pct threshold for considering content stable (default 1.0).

    Returns:
        Tuple of (list of SessionSnapshot, updated CaptureState).
    """
    snapshots: list[SessionSnapshot] = []
    new_captures: dict[str, str] = {}
    new_counters: dict[str, int] = {}

    for pane in panes:
        target = pane["target"]
        text = pane["text"]

        cwd = pane.get("cwd")
        label = extract_label(target)

        old_text = state.previous_captures.get(target, "")
        diff_pct = compute_diff_pct(old_text, text)
        old_counter = state.previous_counters.get(target, 0)
        stable_counter = compute_stable_counter(old_counter, diff_pct, threshold)

        if diff_pct > threshold:
            seconds_since_change = 0
        else:
            seconds_since_change = stable_counter * interval

        preview = text[-PREVIEW_MAX_CHARS:] if len(text) > PREVIEW_MAX_CHARS else text

        snapshots.append(
            SessionSnapshot(
                session_id=target,
                label=label,
                preview=preview,
                cwd=cwd,
                diff_pct=diff_pct,
                stable_counter=stable_counter,
                seconds_since_change=seconds_since_change,
                captured_at=_now_utc_iso(),
            )
        )

        new_captures[target] = text
        new_counters[target] = stable_counter

    updated_state = CaptureState(
        previous_captures=new_captures,
        previous_counters=new_counters,
    )
    return snapshots, updated_state
