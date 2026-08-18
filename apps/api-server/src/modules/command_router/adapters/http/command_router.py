from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from modules.command_router.application.command_service import CommandService
from modules.shared_kernel.error_envelope import APIError, ErrorEnvelope


class SubmitCommandPayload(BaseModel):
    machine_id: str
    session_id: str
    payload: str


class DeliveryPayload(BaseModel):
    delivered: bool
    failure_reason: str | None = None


def create_command_router(service: CommandService) -> APIRouter:
    router = APIRouter(tags=["command-router"])

    @router.post("/command")
    def submit_command(body: SubmitCommandPayload) -> dict[str, str]:
        try:
            command = service.enqueue_command(
                machine_id=body.machine_id,
                session_id=body.session_id,
                payload=body.payload,
            )
        except APIError as err:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=err.status_code,
                content=ErrorEnvelope.from_error(err),
            )

        return {
            "command_id": command.command_id,
            "state": command.state.value,
            "target": command.target,
        }

    @router.get("/commands/{identifier}")
    def get_commands_or_detail(identifier: str) -> dict[str, object]:
        try:
            return service.get_command_detail(identifier)
        except APIError:
            return {"commands": service.fetch_pending_commands(identifier)}

    @router.post("/commands/{command_id}/delivery")
    def report_delivery(command_id: str, body: DeliveryPayload) -> dict[str, str]:
        try:
            service.report_delivery(
                command_id=command_id,
                delivered=body.delivered,
                failure_reason=body.failure_reason,
            )
        except APIError as err:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=err.status_code,
                content=ErrorEnvelope.from_error(err),
            )

        return {"ok": "true"}

    return router
