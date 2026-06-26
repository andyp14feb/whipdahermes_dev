from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from modules.machine_registry.adapters.persistence.machine_repo import SQLMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


class TestSQLMachineRepo:
    def create_repo(self) -> SQLMachineRepo:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return SQLMachineRepo(engine)

    def test_upsert_creates_record(self) -> None:
        repo = self.create_repo()
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:15:00Z",
            session_count=3,
        )

        repo.upsert(machine)

        assert repo.get(MachineId("vm-1")) == machine

    def test_upsert_updates_existing_record(self) -> None:
        repo = self.create_repo()
        first = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-24T08:15:00Z",
            session_count=3,
        )
        repo.upsert(first)
        updated = Machine(
            machine_id="vm-1",
            display_name="VM 1 renamed",
            last_seen_at="2026-06-24T08:20:00Z",
            session_count=5,
        )

        repo.upsert(updated)

        fetched = repo.get(MachineId("vm-1"))
        assert fetched is not None
        assert fetched.display_name == "VM 1 renamed"
        assert fetched.last_seen_at == "2026-06-24T08:20:00Z"
        assert fetched.session_count == 5

    def test_list_all_returns_all_records(self) -> None:
        repo = self.create_repo()
        repo.upsert(
            Machine(
                machine_id="vm-1",
                display_name="VM 1",
                last_seen_at="2026-06-24T08:15:00Z",
            )
        )
        repo.upsert(
            Machine(
                machine_id="vm-2",
                display_name="VM 2",
                last_seen_at="2026-06-24T08:16:00Z",
            )
        )

        machines = repo.list_all()

        assert [machine.machine_id for machine in machines] == ["vm-1", "vm-2"]

    def test_session_count_updates_independently(self) -> None:
        repo = self.create_repo()
        repo.upsert(
            Machine(
                machine_id="vm-1",
                display_name="VM 1",
                last_seen_at="2026-06-24T08:15:00Z",
                session_count=3,
            )
        )

        repo.update_session_count(MachineId("vm-1"), 7)

        fetched = repo.get(MachineId("vm-1"))
        assert fetched is not None
        assert fetched.session_count == 7
        assert fetched.last_seen_at == "2026-06-24T08:15:00Z"
