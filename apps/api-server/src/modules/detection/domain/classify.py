from __future__ import annotations

import re

from modules.detection.domain.signals import SessionSignals
from modules.detection.domain.status import Status
from modules.shared_kernel.time_utils import now_utc, parse_iso

WAITING_INPUT_PATTERNS = [
    r"continue\?",
    r"y/n",
    r"confirm",
    r"press enter",
]


def classify_session(signals: SessionSignals) -> Status:
    try:
        last_seen_dt = parse_iso(signals.last_seen_at)
        now_dt = parse_iso(now_utc())
        seconds_stale = int((now_dt - last_seen_dt).total_seconds())
        if seconds_stale > 60:
            return Status.STALE
    except (ValueError, TypeError):
        pass

    preview_lower = signals.preview.lower()
    for pattern in WAITING_INPUT_PATTERNS:
        if re.search(pattern, preview_lower):
            return Status.WAITING_INPUT

    if signals.diff_pct > 10.0:
        return Status.ACTIVE

    if signals.seconds_since_change < 60:
        return Status.STABLE

    if signals.seconds_since_change <= 180:
        return Status.WAITING

    if signals.seconds_since_change > 180:
        has_progress = signals.stable_counter == 0 or signals.diff_pct > 0.0
        if has_progress:
            return Status.ACTIVE
        return Status.STUCK

    return Status.UNKNOWN
