from __future__ import annotations

from modules.detection.domain.classify import classify_session
from modules.detection.domain.signals import SessionSignals
from modules.detection.domain.status import Status
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot


class DetectionService:
    def __init__(self, stale_timeout_seconds: int = 60) -> None:
        self.stale_timeout_seconds = stale_timeout_seconds

    def classify_session(self, session: Session, snapshot: Snapshot | None = None) -> Status:
        signals = SessionSignals(
            preview=snapshot.preview if snapshot else "",
            diff_pct=snapshot.diff_pct if snapshot else 0.0,
            stable_counter=snapshot.stable_counter if snapshot else 0,
            seconds_since_change=session.seconds_since_change,
            last_seen_at=session.last_seen_at,
        )
        return classify_session(signals, self.stale_timeout_seconds)
