from __future__ import annotations

from modules.detection.application.detection_service import DetectionService
from modules.detection.domain.status import Status
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot


class TestDetectionService:
    def test_classify_constructs_signals_and_returns_status(self) -> None:
        service = DetectionService()
        session = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="test",
            status="unknown",
            seconds_since_change=5,
            last_seen_at="3026-06-26T12:00:00Z",
            cwd="/home/user",
        )
        snapshot = Snapshot(
            session_id="s-1",
            machine_id="vm-1",
            preview="user@host:~$",
            diff_pct=0.0,
            stable_counter=1,
            cwd="/home/user",
            captured_at="3026-06-26T12:00:00Z",
        )

        result = service.classify_session(session, snapshot)

        assert isinstance(result, Status)
        assert result == Status.STABLE

    def test_classify_with_stale_session(self) -> None:
        service = DetectionService()
        session = Session(
            session_id="s-2",
            machine_id="vm-1",
            label="old",
            status="unknown",
            seconds_since_change=999,
            last_seen_at="2000-01-01T00:00:00Z",
            cwd="",
        )
        snapshot = Snapshot(
            session_id="s-2",
            machine_id="vm-1",
            preview="done",
            diff_pct=0.0,
            stable_counter=1,
            cwd="",
            captured_at="2000-01-01T00:00:00Z",
        )

        result = service.classify_session(session, snapshot)

        assert result == Status.STALE

    def test_classify_with_none_snapshot(self) -> None:
        service = DetectionService()
        session = Session(
            session_id="s-3",
            machine_id="vm-1",
            label="new",
            status="unknown",
            seconds_since_change=0,
            last_seen_at="3026-06-26T12:00:00Z",
            cwd="",
        )

        result = service.classify_session(session, None)

        assert result == Status.STABLE

    def test_classify_active_with_high_diff(self) -> None:
        service = DetectionService()
        session = Session(
            session_id="s-4",
            machine_id="vm-1",
            label="building",
            status="unknown",
            seconds_since_change=10,
            last_seen_at="3026-06-26T12:00:00Z",
            cwd="",
        )
        snapshot = Snapshot(
            session_id="s-4",
            machine_id="vm-1",
            preview="compiling...",
            diff_pct=25.0,
            stable_counter=0,
            cwd="",
            captured_at="3026-06-26T12:00:00Z",
        )

        result = service.classify_session(session, snapshot)

        assert result == Status.ACTIVE
