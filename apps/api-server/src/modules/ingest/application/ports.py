from __future__ import annotations

from typing import Protocol

from modules.shared_kernel.ids import MachineId
from modules.ingest.domain.heartbeat_payload import SessionSnapshot


class IMachineRegistryUpserter(Protocol):
    def upsert_from_heartbeat(
        self,
        machine_id: MachineId,
        last_seen_at: str,
        session_count: int,
        db: object | None = None,
        updates_enabled: bool = True,
    ) -> None: ...


class ISessionUpserter(Protocol):
    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot], db: object | None = None
    ) -> None: ...

    def write_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot], db: object | None = None
    ) -> list[tuple[object, object, str]]: ...

    def process_assessments(self, candidates: list[tuple[object, object, str]]) -> None: ...
