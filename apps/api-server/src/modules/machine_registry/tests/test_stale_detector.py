from __future__ import annotations

from datetime import datetime, timedelta, timezone

from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.application.stale_detector import StaleDetector
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


class FakeMachineRepo:
    def __init__(self) -> None:
        self.machines: dict[str, Machine] = {}
        self.mark_stale_calls: list[MachineId] = []
        self.delete_calls: list[MachineId] = []

    def upsert(self, machine: Machine) -> None:
        self.machines[machine.machine_id] = machine

    def get(self, machine_id: MachineId) -> Machine | None:
        return self.machines.get(str(machine_id))

    def list_all(self) -> list[Machine]:
        return list(self.machines.values())

    def update_session_count(self, machine_id: MachineId, count: int) -> None:
        pass

    def mark_stale(self, machine_id: MachineId) -> None:
        self.mark_stale_calls.append(machine_id)
        m = self.machines.get(str(machine_id))
        if m is not None:
            m.is_stale = True

    def delete(self, machine_id: MachineId) -> None:
        self.delete_calls.append(machine_id)
        self.machines.pop(str(machine_id), None)


class FakeSessionRepo:
    def __init__(self) -> None:
        self.delete_machine_calls: list[str] = []

    def upsert(self, session) -> None:
        pass

    def get(self, session_id: str) -> None:
        return None

    def list_by_machine(self, machine_id: str) -> list:
        return []

    def list_all(self) -> list:
        return []

    def append_snapshot(self, snapshot) -> None:
        pass

    def get_latest_snapshot(self, session_id: str) -> None:
        return None

    def update_status(self, session_id: str, status: str) -> None:
        pass

    def delete_all_by_machine(self, machine_id: str) -> None:
        self.delete_machine_calls.append(machine_id)


def _make_machine(machine_id: str, last_seen_at: str, is_stale: bool = False) -> Machine:
    return Machine(
        machine_id=machine_id,
        display_name=machine_id,
        last_seen_at=last_seen_at,
        session_count=1,
        is_stale=is_stale,
    )


class TestStaleDetector:
    def test_marks_machine_stale_when_past_timeout(self) -> None:
        machine_repo = FakeMachineRepo()
        session_repo = FakeSessionRepo()
        now = datetime.now(tz=timezone.utc)
        old_time = (now - timedelta(seconds=120)).isoformat()
        machine_repo.upsert(_make_machine("vm-1", old_time))
        service = MachineService(machine_repo)
        detector = StaleDetector(service, session_repo, stale_timeout_seconds=60, cleanup_timeout_seconds=86400)

        detector.sweep()

        assert machine_repo.mark_stale_calls == [MachineId("vm-1")]
        assert machine_repo.machines["vm-1"].is_stale is True

    def test_does_not_mark_stale_when_within_timeout(self) -> None:
        machine_repo = FakeMachineRepo()
        session_repo = FakeSessionRepo()
        now = datetime.now(tz=timezone.utc)
        recent_time = (now - timedelta(seconds=30)).isoformat()
        machine_repo.upsert(_make_machine("vm-1", recent_time))
        service = MachineService(machine_repo)
        detector = StaleDetector(service, session_repo, stale_timeout_seconds=60, cleanup_timeout_seconds=86400)

        detector.sweep()

        assert machine_repo.mark_stale_calls == []
        assert machine_repo.machines["vm-1"].is_stale is False

    def test_does_not_mark_already_stale_machine_again(self) -> None:
        machine_repo = FakeMachineRepo()
        session_repo = FakeSessionRepo()
        now = datetime.now(tz=timezone.utc)
        old_time = (now - timedelta(seconds=120)).isoformat()
        machine_repo.upsert(_make_machine("vm-1", old_time, is_stale=True))
        service = MachineService(machine_repo)
        detector = StaleDetector(service, session_repo, stale_timeout_seconds=60, cleanup_timeout_seconds=86400)

        detector.sweep()

        assert machine_repo.mark_stale_calls == []

    def test_cleans_up_machine_and_sessions_when_past_cleanup_timeout(self) -> None:
        machine_repo = FakeMachineRepo()
        session_repo = FakeSessionRepo()
        now = datetime.now(tz=timezone.utc)
        ancient_time = (now - timedelta(seconds=90000)).isoformat()
        machine_repo.upsert(_make_machine("vm-1", ancient_time, is_stale=True))
        service = MachineService(machine_repo)
        detector = StaleDetector(service, session_repo, stale_timeout_seconds=60, cleanup_timeout_seconds=86400)

        detector.sweep()

        assert machine_repo.delete_calls == [MachineId("vm-1")]
        assert session_repo.delete_machine_calls == ["vm-1"]
        assert "vm-1" not in machine_repo.machines

    def test_ignores_recently_seen_machine(self) -> None:
        machine_repo = FakeMachineRepo()
        session_repo = FakeSessionRepo()
        now = datetime.now(tz=timezone.utc)
        recent_time = (now - timedelta(seconds=5)).isoformat()
        machine_repo.upsert(_make_machine("vm-1", recent_time))
        service = MachineService(machine_repo)
        detector = StaleDetector(service, session_repo, stale_timeout_seconds=60, cleanup_timeout_seconds=86400)

        detector.sweep()

        assert machine_repo.mark_stale_calls == []
        assert machine_repo.delete_calls == []
        assert session_repo.delete_machine_calls == []
