from __future__ import annotations

from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


class FakeMachineRepo:
    def __init__(self, machine: Machine | None = None) -> None:
        self.machine = machine
        self.upsert_calls: list[Machine] = []
        self.mark_stale_calls: list[MachineId] = []

    def upsert(self, machine: Machine) -> None:
        self.machine = machine
        self.upsert_calls.append(machine)

    def get(self, machine_id: MachineId) -> Machine | None:
        if self.machine is not None and self.machine.machine_id == str(machine_id):
            return self.machine
        return None

    def list_all(self) -> list[Machine]:
        return [self.machine] if self.machine is not None else []

    def update_session_count(self, machine_id: MachineId, count: int) -> None:
        if self.machine is not None and self.machine.machine_id == str(machine_id):
            self.machine.session_count = count

    def mark_stale(self, machine_id: MachineId) -> None:
        self.mark_stale_calls.append(machine_id)
        if self.machine is not None and self.machine.machine_id == str(machine_id):
            self.machine.is_stale = True


class TestMachineService:
    def test_upsert_creates_new_machine_for_unknown_machine_id(self) -> None:
        repo = FakeMachineRepo()
        service = MachineService(repo)

        machine = service.upsert_from_heartbeat(
            MachineId("vm-1"), "2026-06-24T08:15:00Z", 3
        )

        assert machine.machine_id == "vm-1"
        assert machine.display_name == "vm-1"
        assert machine.last_seen_at == "2026-06-24T08:15:00Z"
        assert machine.session_count == 3
        assert machine.is_stale is False
        assert repo.upsert_calls == [machine]

    def test_upsert_updates_last_seen_at_for_known_machine(self) -> None:
        existing = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:10:00Z",
            session_count=1,
            is_stale=True,
        )
        repo = FakeMachineRepo(existing)
        service = MachineService(repo)

        machine = service.upsert_from_heartbeat(
            MachineId("vm-1"), "2026-06-24T08:15:00Z", 4
        )

        assert machine is existing
        assert existing.last_seen_at == "2026-06-24T08:15:00Z"
        assert existing.session_count == 4
        assert existing.is_stale is False
        assert repo.upsert_calls[-1] is existing

    def test_list_machines_returns_all_machines(self) -> None:
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:10:00Z",
            session_count=1,
        )
        repo = FakeMachineRepo(machine)
        service = MachineService(repo)

        assert service.list_machines() == [machine]

    def test_get_machine_returns_correct_machine(self) -> None:
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:10:00Z",
            session_count=1,
        )
        repo = FakeMachineRepo(machine)
        service = MachineService(repo)

        assert service.get_machine(MachineId("vm-1")) == machine

    def test_get_machine_returns_none_for_unknown(self) -> None:
        service = MachineService(FakeMachineRepo())

        assert service.get_machine(MachineId("missing")) is None

    def test_mark_stale_sets_is_stale_true(self) -> None:
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-26T12:00:00Z",
            session_count=1,
            is_stale=False,
        )
        repo = FakeMachineRepo(machine)
        service = MachineService(repo)

        service.mark_stale(MachineId("vm-1"))

        assert MachineId("vm-1") in repo.mark_stale_calls
        assert machine.is_stale is True

    def test_upsert_from_heartbeat_resets_is_stale(self) -> None:
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:00:00Z",
            session_count=1,
            is_stale=True,
        )
        repo = FakeMachineRepo(machine)
        service = MachineService(repo)

        service.upsert_from_heartbeat(MachineId("vm-1"), "2026-06-26T12:00:00Z", 2)

        assert machine.is_stale is False
