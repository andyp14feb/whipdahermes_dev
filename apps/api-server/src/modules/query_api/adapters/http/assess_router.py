from __future__ import annotations

from fastapi import APIRouter, Request
from starlette.responses import JSONResponse

from modules.query_api.application.query_service import QueryService
from modules.session_state.adapters.ai_assessor import HttpProviderAssessor
from modules.session_state.application.ports import ISessionAssessor
from modules.session_state.application.session_service import SessionService
from modules.session_state.application.transition_gate import should_assess_status


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


class AssessNotEligible(JSONResponse):
    def __init__(self, status: str) -> None:
        super().__init__(
            status_code=409,
            content={
                "error": {
                    "code": "NOT_ELIGIBLE",
                    "message": f"Session status '{status}' is not eligible for AI assessment",
                }
            },
        )


def create_assess_router(
    service: SessionService,
    assessor: ISessionAssessor | None,
    query_service: QueryService | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/assess", tags=["assessment"])

    @router.post("/{machine_id}/{session_id}", response_model=None)
    def assess_session(
        machine_id: str, session_id: str, request: Request
    ) -> dict[str, object] | JSONResponse:
        session = service.get_session(machine_id, session_id)
        if session is None or session.machine_id != machine_id:
            return SessionNotFound()
        if not should_assess_status(session.status):
            return AssessNotEligible(session.status)

        effective_assessor = assessor
        provider_base_url = request.headers.get("x-ai-provider-base-url")
        provider_model = request.headers.get("x-ai-model")
        provider_type = request.headers.get("x-ai-provider-type", "openai-compatible")
        if effective_assessor is None and provider_base_url and provider_model:
            effective_assessor = HttpProviderAssessor(
                base_url=provider_base_url,
                api_key=request.headers.get("x-ai-api-key", ""),
                model=provider_model,
                provider_type=provider_type,
            )

        if effective_assessor is None:
            return AssessorUnavailable()

        assessed = service.assess_session(machine_id, session_id, effective_assessor)
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
