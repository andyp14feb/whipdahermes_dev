from __future__ import annotations

from fastapi import APIRouter

from modules.query_api.application.query_service import QueryService


def create_sessions_router(service: QueryService) -> APIRouter:
    router = APIRouter(prefix="/sessions", tags=["sessions"])

    @router.get("")
    def list_sessions() -> dict[str, list[dict[str, object]]]:
        return service.get_sessions()

    return router
