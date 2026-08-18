from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.machine_registry.adapters.persistence.machine_repo import SQLMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.session_state.adapters.persistence.session_repo import SQLSessionRepo
from modules.session_state.domain.session import Session


class TestSQLMachineRepo:
    def create_repo(self) -> tuple[SQLMachineRepo, SQLSessionRepo]:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return SQLMachineRepo(engine), SQLSessionRepo(engine)

    def test_delete_removes_machine(self) -> None:
        repo, _ = self.create_repo()
        machine = Machine(
            machine_id="vm-1",
            display_name="VM 1",
            last_seen_at="2026-06-26T12:00:00Z",
        )
        repo.upsert(machine)

        repo.delete("vm-1")

        assert repo.get("vm-1") is None

    def test_vm_local_cleanup_removes_only_deprecated_identity_when_worker_exists(self) -> None:
        machine_repo, session_repo = self.create_repo()
        machine_repo.upsert(
            Machine(machine_id="vm-local", display_name="vm-local", last_seen_at="2026-06-26T12:00:00Z")
        )
        machine_repo.upsert(
            Machine(machine_id="worker-vbox68", display_name="worker-vbox68", last_seen_at="2026-06-26T12:00:00Z")
        )
        machine_repo.upsert(
            Machine(machine_id="worker-vbox070", display_name="worker-vbox070", last_seen_at="2026-06-26T12:00:00Z")
        )
        session_repo.upsert(
            Session(
                machine_id="vm-local",
                session_id="s-local",
                label="local",
                status="active",
                seconds_since_change=1,
                last_seen_at="2026-06-26T12:00:00Z",
            )
        )
        session_repo.upsert(
            Session(
                machine_id="worker-vbox68",
                session_id="s-worker",
                label="worker",
                status="active",
                seconds_since_change=1,
                last_seen_at="2026-06-26T12:00:00Z",
            )
        )

        machine_repo.delete_deprecated_local_machine_rows()
        session_repo.delete_deprecated_local_machine_sessions()

        machines = sorted(machine.machine_id for machine in machine_repo.list_all())
        sessions = sorted((session.machine_id, session.session_id) for session in session_repo.list_all())

        assert machines == ["worker-vbox070", "worker-vbox68"]
        assert sessions == [("worker-vbox68", "s-worker")]
