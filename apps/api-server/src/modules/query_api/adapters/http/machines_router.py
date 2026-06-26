from __future__ import annotations

from fastapi import APIRouter

from modules.query_api.application.query_service import QueryService


def create_machines_router(service: QueryService) -> APIRouter:
    router = APIRouter(prefix="/machines", tags=["machines"])

    @router.get("")
    def list_machines() -> dict[str, list[dict[str, object]]]:
        return service.get_machines()

    return router
