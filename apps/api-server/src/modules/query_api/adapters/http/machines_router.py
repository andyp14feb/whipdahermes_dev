from __future__ import annotations

from fastapi import APIRouter

from modules.query_api.application.query_service import QueryService


def create_machines_router(service: QueryService) -> APIRouter:
    router = APIRouter(prefix="/machines", tags=["machines"])

    @router.get("")
    def list_machines() -> dict[str, list[dict[str, object]]]:
        return service.get_machines()

    @router.delete("/{machine_id}")
    def delete_machine(machine_id: str) -> dict[str, str]:
        deleted = service.delete_machine_by_id(machine_id)
        return {"status": "deleted" if deleted else "not_found", "machine_id": machine_id}

    return router
