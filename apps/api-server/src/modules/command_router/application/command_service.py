from __future__ import annotations

from modules.command_router.application.ports import ICommandRepo, ISessionResultUpdater
from modules.command_router.domain.command import Command
from modules.shared_kernel.error_envelope import APIError
from modules.shared_kernel.ids import CommandId
from modules.shared_kernel.time_utils import now_utc


class CommandService:
    def __init__(
        self,
        repo: ICommandRepo,
        session_result_updater: ISessionResultUpdater | None = None,
    ) -> None:
        self.repo = repo
        self.session_result_updater = session_result_updater

    def enqueue_command(
        self,
        machine_id: str,
        session_id: str,
        payload: str,
    ) -> Command:
        if not machine_id or not machine_id.strip():
            raise APIError(
                code="VALIDATION_ERROR",
                message="machine_id must not be empty",
                status_code=422,
            )
        if not session_id or not session_id.strip():
            raise APIError(
                code="VALIDATION_ERROR",
                message="session_id must not be empty",
                status_code=422,
            )
        if not payload or not payload.strip():
            raise APIError(
                code="VALIDATION_ERROR",
                message="payload must not be empty",
                status_code=422,
            )

        command = self.repo.enqueue(machine_id, session_id, payload)
        return command

    def fetch_pending_commands(self, machine_id: str) -> list[dict[str, str]]:
        commands = self.repo.find_pending_by_machine(machine_id)
        return [
            {
                "command_id": command.command_id,
                "session_id": command.session_id,
                "payload": command.payload,
            }
            for command in commands
        ]

    def report_delivery(
        self,
        command_id: str,
        delivered: bool,
        failure_reason: str | None,
    ) -> Command:
        command = self.repo.find_by_id(command_id)
        if command is None:
            raise APIError(
                code="COMMAND_NOT_FOUND",
                message=f"Command {command_id} not found",
                status_code=404,
            )

        if delivered:
            updated = self.repo.update_state(
                command_id,
                "delivered",
                delivered_at=now_utc(),
            )
        else:
            updated = self.repo.update_state(
                command_id,
                "failed",
                delivered_at=now_utc(),
                failure_reason=failure_reason,
            )

        if self.session_result_updater is not None:
            status_update = "delivered" if delivered else "failed"
            self.session_result_updater.upsert_from_command_result(
                machine_id=updated.machine_id,
                session_id=updated.session_id,
                status_update=status_update,
            )

        return updated

    def get_command_detail(self, command_id: str) -> dict[str, object]:
        command = self.repo.find_by_id(command_id)
        if command is None:
            raise APIError(
                code="COMMAND_NOT_FOUND",
                message=f"Command {command_id} not found",
                status_code=404,
            )

        return {
            "command_id": command.command_id,
            "state": command.state.value,
            "target": command.target,
            "payload": command.payload,
            "accepted_at": command.accepted_at,
            "delivered_at": command.delivered_at,
            "failure_reason": command.failure_reason,
        }
