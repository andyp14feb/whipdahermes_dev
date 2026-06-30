from __future__ import annotations

from fastapi import APIRouter

from modules.query_api.application.query_service import QueryService


def create_sessions_router(service: QueryService) -> APIRouter:
    router = APIRouter(prefix="/sessions", tags=["sessions"])

    @router.get("")
    def list_sessions() -> dict[str, list[dict[str, object]]]:
        return service.get_sessions()

    @router.delete("/{session_id}")
    def delete_session(session_id: str) -> dict[str, str]:
        service.delete_session_by_id(session_id)
        return {"status": "deleted", "session_id": session_id}

    return router
