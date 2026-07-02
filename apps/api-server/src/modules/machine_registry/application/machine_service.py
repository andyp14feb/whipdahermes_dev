from __future__ import annotations

from modules.machine_registry.application.ports import IMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


class MachineService:
    def __init__(self, repo: IMachineRepo) -> None:
        self.repo = repo

    def upsert_from_heartbeat(
        self, machine_id: MachineId, last_seen_at: str, session_count: int
    ) -> Machine:
        existing = self.repo.get(machine_id)
        if existing is not None:
            existing.last_seen_at = last_seen_at
            existing.session_count = session_count
            existing.is_stale = False
            self.repo.upsert(existing)
            return existing

        machine = Machine(
            machine_id=str(machine_id),
            display_name=str(machine_id),
            last_seen_at=last_seen_at,
            session_count=session_count,
            is_stale=False,
        )
        self.repo.upsert(machine)
        return machine

    def upsert_machine(self, machine_id: MachineId, last_seen_at: str) -> None:
        existing = self.repo.get(machine_id)
        session_count = existing.session_count if existing is not None else 0
        self.upsert_from_heartbeat(machine_id, last_seen_at, session_count)

    def get_machine(self, machine_id: MachineId) -> Machine | None:
        return self.repo.get(machine_id)

    def list_machines(self) -> list[Machine]:
        return self.repo.list_all()

    def mark_stale(self, machine_id: MachineId) -> None:
        self.repo.mark_stale(machine_id)

    def delete_machine(self, machine_id: MachineId) -> bool:
        existing = self.repo.get(machine_id)
        if existing is None:
            return False
        self.repo.delete(machine_id)
        return True
