from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.machine_registry.adapters.persistence.machine_repo import SQLMachineRepo
from modules.machine_registry.domain.machine import Machine


class TestSQLMachineRepo:
    def create_repo(self) -> SQLMachineRepo:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return SQLMachineRepo(engine)

    def test_delete_removes_machine(self) -> None:
        repo = self.create_repo()
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(machine)

        repo.delete("vm-1")

        assert repo.get("vm-1") is None
