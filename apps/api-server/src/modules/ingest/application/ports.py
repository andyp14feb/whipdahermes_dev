from __future__ import annotations

from typing import Protocol

from modules.shared_kernel.ids import MachineId
from modules.ingest.domain.heartbeat_payload import SessionSnapshot


class IMachineRegistryUpserter(Protocol):
    def upsert_machine(self, machine_id: MachineId, last_seen_at: str) -> None: ...


class ISessionUpserter(Protocol):
    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot]
    ) -> None: ...
