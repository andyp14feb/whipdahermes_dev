from __future__ import annotations

from fastapi import APIRouter

from modules.machine_registry.application.machine_service import MachineService


def create_machine_router(service: MachineService) -> APIRouter:
    router = APIRouter(prefix="/machines", tags=["machines"])

    @router.get("")
    def list_machines() -> dict[str, list[dict[str, object]]]:
        machines = service.list_machines()
        return {
            "machines": [
                {
                    "machine_id": machine.machine_id,
                    "display_name": machine.display_name,
                    "last_seen_at": machine.last_seen_at,
                    "session_count": machine.session_count,
                    "is_stale": machine.is_stale,
                }
                for machine in machines
            ]
        }

    return router
