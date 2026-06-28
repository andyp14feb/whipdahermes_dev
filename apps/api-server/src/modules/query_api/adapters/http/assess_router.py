from __future__ import annotations

from fastapi import APIRouter
from starlette.responses import JSONResponse

from modules.session_state.application.ports import ISessionAssessor
from modules.session_state.application.session_service import SessionService


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


class AssessorUnavailable(JSONResponse):
    def __init__(self) -> None:
        super().__init__(
            status_code=503,
            content={
                "error": {
                    "code": "ASSESSOR_UNAVAILABLE",
                    "message": "Session assessor is not configured",
                }
            },
        )


def create_assess_router(
    service: SessionService,
    assessor: ISessionAssessor | None,
) -> APIRouter:
    router = APIRouter(prefix="/assess", tags=["assessment"])

    @router.post("/{machine_id}/{session_id}", response_model=None)
    def assess_session(machine_id: str, session_id: str) -> dict[str, object] | JSONResponse:
        session = service.get_session(machine_id, session_id)
        if session is None or session.machine_id != machine_id:
            return SessionNotFound()
        if assessor is None:
            return AssessorUnavailable()

        assessed = service.assess_session(machine_id, session_id, assessor)
        if assessed is None:
            return SessionNotFound()
        return {
            "machine_id": assessed.machine_id,
            "session_id": assessed.session_id,
            "ai_assessment": assessed.ai_assessment,
            "ai_assessment_reason": assessed.ai_assessment_reason,
            "ai_assessed_at": assessed.ai_assessed_at,
        }

    return router
