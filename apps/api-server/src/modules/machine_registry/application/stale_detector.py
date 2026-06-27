from __future__ import annotations

import logging

from modules.machine_registry.application.machine_service import MachineService
from modules.session_state.application.ports import ISessionRepo
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.time_utils import now_utc, parse_iso

logger = logging.getLogger(__name__)


class StaleDetector:
    def __init__(
        self,
        machine_service: MachineService,
        session_repo: ISessionRepo,
        stale_timeout_seconds: int,
        cleanup_timeout_seconds: int,
    ) -> None:
        self.machine_service = machine_service
        self.session_repo = session_repo
        self.stale_timeout_seconds = stale_timeout_seconds
        self.cleanup_timeout_seconds = cleanup_timeout_seconds

    def sweep(self) -> None:
        current_time = parse_iso(now_utc())
        for machine in self.machine_service.list_machines():
            age_seconds = int(
                (current_time - parse_iso(machine.last_seen_at)).total_seconds()
            )
            machine_id = MachineId(machine.machine_id)
            if age_seconds > self.cleanup_timeout_seconds:
                self.session_repo.delete_all_by_machine(machine.machine_id)
                self.machine_service.repo.delete(machine_id)
                logger.info(
                    "stale machine cleanup",
                    extra={"machine_id": machine.machine_id, "action": "cleaned"},
                )
                continue
            if age_seconds > self.stale_timeout_seconds and not machine.is_stale:
                self.machine_service.mark_stale(machine_id)
                logger.info(
                    "stale machine marked",
                    extra={"machine_id": machine.machine_id, "action": "stale_marked"},
                )
