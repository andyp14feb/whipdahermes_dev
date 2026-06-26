from __future__ import annotations

from modules.shared_kernel.error_envelope import APIError
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.time_utils import now_utc
from modules.ingest.application.ports import IMachineRegistryUpserter, ISessionUpserter
from modules.ingest.domain.heartbeat_payload import HeartbeatPayload


class HeartbeatService:
    def __init__(
        self,
        machine_registry: IMachineRegistryUpserter,
        session_state: ISessionUpserter,
    ) -> None:
        self.machine_registry = machine_registry
        self.session_state = session_state

    def process_heartbeat(self, payload: HeartbeatPayload) -> int:
        machine_id = MachineId(payload.machine_id)
        now = now_utc()

        try:
            self.machine_registry.upsert_machine(machine_id, now)
        except APIError:
            raise

        self.session_state.upsert_from_heartbeat(machine_id, payload.sessions)

        return len(payload.sessions)
