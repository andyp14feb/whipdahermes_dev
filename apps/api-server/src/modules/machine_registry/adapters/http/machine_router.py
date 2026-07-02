from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter

from modules.machine_registry.application.machine_service import MachineService


def create_machine_router(
    service: MachineService,
    delete_sessions_by_machine: Callable[[str], None] | None = None,
) -> APIRouter:
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

    @router.delete("/{machine_id}")
    def delete_machine(machine_id: str) -> dict[str, str]:
        deleted = service.delete_machine(machine_id)
        if delete_sessions_by_machine is not None:
            delete_sessions_by_machine(machine_id)
        return {
            "status": "deleted" if deleted else "not_found",
            "machine_id": machine_id,
        }

    return router
