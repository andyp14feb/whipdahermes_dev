from __future__ import annotations

from sqlmodel import Session as SQLSession

from modules.shared_kernel.error_envelope import APIError
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock
from modules.shared_kernel.time_utils import now_utc
from modules.ingest.application.ports import IMachineRegistryUpserter, ISessionUpserter
from modules.ingest.domain.heartbeat_payload import HeartbeatPayload


class HeartbeatService:
    def __init__(
        self,
        machine_registry: IMachineRegistryUpserter,
        session_state: ISessionUpserter,
        engine=None,
    ) -> None:
        self.machine_registry = machine_registry
        self.session_state = session_state
        self.engine = engine

    def process_heartbeat(self, payload: HeartbeatPayload) -> int:
        machine_id = MachineId(payload.machine_id)
        now = now_utc()

        if self.engine is None:
            # No shared engine wired in (e.g. tests using fakes) — fall back to
            # each collaborator managing its own transaction/lock.
            try:
                self.machine_registry.upsert_machine(machine_id, now)
            except APIError:
                raise
            self.session_state.upsert_from_heartbeat(machine_id, payload.sessions)
            return len(payload.sessions)

        with sqlite_write_lock(), SQLSession(self.engine) as db:
            try:
                self.machine_registry.upsert_machine(machine_id, now, db=db)
            except APIError:
                raise
            candidates = self.session_state.write_heartbeat(machine_id, payload.sessions, db=db)
            db.commit()

        # Assessment may call a slow external/AI service — run it after the
        # shared write transaction/lock has been released.
        self.session_state.process_assessments(candidates)

        return len(payload.sessions)
