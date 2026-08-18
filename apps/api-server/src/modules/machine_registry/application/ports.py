from __future__ import annotations

from typing import Protocol

from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


class IMachineRepo(Protocol):
    def upsert(self, machine: Machine, db: object | None = None) -> None: ...

    def get(self, machine_id: MachineId) -> Machine | None: ...

    def list_all(self) -> list[Machine]: ...

    def update_session_count(self, machine_id: MachineId, count: int) -> None: ...

    def mark_stale(self, machine_id: MachineId) -> None: ...

    def delete(self, machine_id: MachineId) -> None: ...
