from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SessionSignals:
    preview: str
    diff_pct: float
    stable_counter: int
    seconds_since_change: int
    last_seen_at: str
