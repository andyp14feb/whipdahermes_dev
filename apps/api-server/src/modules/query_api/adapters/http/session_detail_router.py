from __future__ import annotations

from fastapi import APIRouter
from starlette.responses import JSONResponse

from modules.query_api.application.query_service import QueryService


class SessionNotFound(JSONResponse):
    def __init__(self) -> None:
        super().__init__(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Session not found",
                }
            },
        )


def create_session_detail_router(service: QueryService) -> APIRouter:
    router = APIRouter(prefix="/sessions", tags=["sessions"])

    @router.get(
        "/{machine_id}/{session_id}",
        response_model=None,
    )
    def get_session_detail(
        machine_id: str, session_id: str
    ) -> dict[str, object] | JSONResponse:
        detail = service.get_session_detail(machine_id, session_id)
        if detail is None:
            return SessionNotFound()
        return detail

    return router
