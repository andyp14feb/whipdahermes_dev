from __future__ import annotations

from datetime import datetime, timezone

from modules.machine_registry.domain.machine import Machine
from modules.query_api.application.query_service import QueryService
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.time_utils import now_utc

NOW = now_utc()


class FakeMachineReader:
    def __init__(self) -> None:
        self.machines: dict[str, Machine] = {}

    def list_all(self) -> list[Machine]:
        return list(self.machines.values())

    def get(self, machine_id: str) -> Machine | None:
        return self.machines.get(machine_id)


class FakeSessionReader:
    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.snapshots: dict[str, list[Snapshot]] = {}

    def list_all(self) -> list[Session]:
        return list(self.sessions.values())

    def get(self, machine_id: str, session_id: str) -> Session | None:
        session = self.sessions.get(session_id)
        if session is not None and session.machine_id != machine_id:
            return None
        return session

    def get_latest_snapshot(self, machine_id: str, session_id: str) -> Snapshot | None:
        snaps = self.snapshots.get(session_id, [])
        return snaps[-1] if snaps else None


class TestQueryService:
    def test_get_machines_returns_all_machines(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=3,
        )
        machine_reader.machines["vm-2"] = Machine(
            machine_id="vm-2",
            display_name="VM 2",
            last_seen_at=NOW,
            session_count=1,
        )

        result = service.get_machines()

        # Sort for deterministic comparison
        result_sorted = sorted(result["machines"], key=lambda m: m["machine_id"])
        expected_sorted = sorted([
            {
                "machine_id": "vm-1",
                "display_name": "VM 1",
                "last_seen_at": NOW,
                "session_count": 3,
                "is_stale": False,
            },
            {
                "machine_id": "vm-2",
                "display_name": "VM 2",
                "last_seen_at": NOW,
                "session_count": 1,
                "is_stale": False,
            },
        ], key=lambda m: m["machine_id"])
        assert result_sorted == expected_sorted

    def test_get_machines_returns_empty_list_when_no_machines(self) -> None:
        service = QueryService(FakeMachineReader(), FakeSessionReader(), stale_timeout_seconds=86400)

        result = service.get_machines()

        assert result == {"machines": []}

    def test_get_sessions_returns_all_sessions(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=2,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Session 1",
            status="active",
            seconds_since_change=5,
            last_seen_at=NOW,
        )
        session_reader.sessions["s-2"] = Session(
            session_id="s-2",
            machine_id="vm-1",
            label="Session 2",
            status="stable",
            seconds_since_change=30,
            last_seen_at=NOW,
        )

        result = service.get_sessions()

        assert len(result["sessions"]) == 2
        s1 = next(s for s in result["sessions"] if s["session_id"] == "s-1")
        s2 = next(s for s in result["sessions"] if s["session_id"] == "s-2")
        assert s1["label"] == "Session 1"
        assert s1["status"] in ("active", "stable")
        assert s2["label"] == "Session 2"

    def test_get_sessions_returns_empty_list_when_no_sessions(self) -> None:
        service = QueryService(FakeMachineReader(), FakeSessionReader(), stale_timeout_seconds=86400)

        result = service.get_sessions()

        assert result == {"sessions": []}

    def test_get_sessions_from_multiple_machines(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=1,
        )
        machine_reader.machines["vm-2"] = Machine(
            machine_id="vm-2",
            display_name="VM 2",
            last_seen_at=NOW,
            session_count=1,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="S1",
            status="active",
            last_seen_at=NOW,
        )
        session_reader.sessions["s-2"] = Session(
            session_id="s-2",
            machine_id="vm-2",
            label="S2",
            status="stable",
            last_seen_at=NOW,
        )

        result = service.get_sessions()

        assert len(result["sessions"]) == 2

    def test_get_session_detail_returns_full_detail(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=1,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Session 1",
            status="active",
            seconds_since_change=10,
            last_seen_at=NOW,
            cwd="/home/user",
        )
        session_reader.snapshots["s-1"] = [
            Snapshot(
                snapshot_id=1,
                session_id="s-1",
                machine_id="vm-1",
                preview="user@host:~$",
                diff_pct=0.0,
                stable_counter=1,
                cwd="/home/user",
                captured_at=NOW,
            )
        ]

        result = service.get_session_detail("vm-1", "s-1")

        assert result is not None
        assert result["machine_id"] == "vm-1"
        assert result["session_id"] == "s-1"
        assert result["label"] == "Session 1"
        assert result["seconds_since_change"] == 10
        assert result["preview"] == "user@host:~$"
        assert result["cwd"] == "/home/user"
        assert result["last_seen_at"] == NOW

    def test_get_session_detail_returns_none_for_missing_session(self) -> None:
        service = QueryService(FakeMachineReader(), FakeSessionReader(), stale_timeout_seconds=86400)

        result = service.get_session_detail("vm-1", "nonexistent")

        assert result is None

    def test_get_session_detail_returns_none_for_wrong_machine(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="S1",
            last_seen_at=NOW,
        )

        result = service.get_session_detail("vm-2", "s-1")

        assert result is None

    def test_get_session_detail_without_snapshot_returns_empty_preview(
        self,
    ) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at=NOW,
            session_count=1,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="S1",
            status="active",
            last_seen_at=NOW,
        )

        result = service.get_session_detail("vm-1", "s-1")

        assert result is not None
        assert result["preview"] == ""

    def test_stale_machine_propagates_stale_to_sessions(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="Stale VM",
            last_seen_at="2026-06-26T10:00:00Z",
            session_count=1,
            is_stale=True,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Old Session",
            status="active",
            seconds_since_change=9999,
            last_seen_at="2026-06-26T10:00:00Z",
        )

        sessions_result = service.get_sessions()
        detail_result = service.get_session_detail("vm-1", "s-1")

        assert sessions_result["sessions"][0]["status"] == "stale"
        assert detail_result is not None
        assert detail_result["status"] == "stale"

    def test_stale_machine_adds_elapsed_time_to_session_idle_seconds(self, monkeypatch) -> None:
        import modules.query_api.application.query_service as query_service_module

        monkeypatch.setattr(query_service_module, "now_utc", lambda: "2026-07-03T09:00:00Z")
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=60)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="Stale VM",
            last_seen_at="2026-07-03T08:00:00Z",
            session_count=1,
            is_stale=True,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Old Session",
            status="stable",
            seconds_since_change=120,
            last_seen_at="2026-07-03T08:00:00Z",
        )

        sessions_result = service.get_sessions()
        detail_result = service.get_session_detail("vm-1", "s-1")

        assert sessions_result["sessions"][0]["status"] == "stale"
        assert sessions_result["sessions"][0]["seconds_since_change"] == 3720
        assert detail_result is not None
        assert detail_result["status"] == "stale"
        assert detail_result["seconds_since_change"] == 3720

    def test_non_stale_machine_preserves_session_status(self) -> None:
        machine_reader = FakeMachineReader()
        session_reader = FakeSessionReader()
        service = QueryService(machine_reader, session_reader, stale_timeout_seconds=86400)
        machine_reader.machines["vm-1"] = Machine(
            machine_id="vm-1",
            display_name="Healthy VM",
            last_seen_at=NOW,
            session_count=1,
            is_stale=False,
        )
        session_reader.sessions["s-1"] = Session(
            session_id="s-1",
            machine_id="vm-1",
            label="Active Session",
            status="active",
            seconds_since_change=5,
            last_seen_at=NOW,
        )

        result = service.get_sessions()

        assert result["sessions"][0]["status"] == "active"
