from __future__ import annotations

from typing import Protocol

from modules.command_router.domain.command import Command


class ICommandRepo(Protocol):
    def enqueue(self, machine_id: str, session_id: str, payload: str) -> Command: ...

    def find_by_id(self, command_id: str) -> Command | None: ...

    def find_pending_by_machine(self, machine_id: str) -> list[Command]: ...

    def update_state(
        self,
        command_id: str,
        state: str,
        **kwargs: object,
    ) -> Command: ...


class ISessionResultUpdater(Protocol):
    def upsert_from_command_result(
        self,
        machine_id: str,
        session_id: str,
        status_update: str | None = None,
    ) -> None: ...
