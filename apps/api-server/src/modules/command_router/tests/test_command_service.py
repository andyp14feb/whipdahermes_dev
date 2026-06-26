from __future__ import annotations

from modules.command_router.application.command_service import CommandService
from modules.command_router.domain.command import Command, CommandState


class FakeCommandRepo:
    def __init__(self) -> None:
        self.commands: dict[str, Command] = {}
        self.counter = 0

    def enqueue(self, machine_id: str, session_id: str, payload: str) -> Command:
        self.counter += 1
        command = Command(
            command_id=f"cmd-{self.counter}",
            machine_id=machine_id,
            session_id=session_id,
            payload=payload,
            state=CommandState.accepted,
            target=f"{machine_id}:{session_id}",
            requested_at="2026-06-26T00:00:00+00:00",
            accepted_at="2026-06-26T00:00:00+00:00",
        )
        self.commands[command.command_id] = command
        return command

    def find_by_id(self, command_id: str) -> Command | None:
        return self.commands.get(command_id)

    def find_pending_by_machine(self, machine_id: str) -> list[Command]:
        return [
            command
            for command in self.commands.values()
            if command.machine_id == machine_id and command.state == CommandState.accepted
        ]

    def update_state(self, command_id: str, state: str, **kwargs: object) -> Command:
        command = self.commands[command_id]
        command.state = CommandState(state)
        for key, value in kwargs.items():
            setattr(command, key, value)
        return command


class FakeSessionUpdater:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str | None]] = []

    def upsert_from_command_result(
        self,
        machine_id: str,
        session_id: str,
        status_update: str | None = None,
    ) -> None:
        self.calls.append((machine_id, session_id, status_update))


class TestCommandService:
    def test_enqueue_command_creates_accepted_command(self) -> None:
        service = CommandService(FakeCommandRepo())

        command = service.enqueue_command("vm-1", "sess-1", "ls")

        assert command.command_id == "cmd-1"
        assert command.state == CommandState.accepted
        assert command.target == "vm-1:sess-1"

    def test_fetch_pending_commands_returns_lightweight_list(self) -> None:
        repo = FakeCommandRepo()
        repo.enqueue("vm-1", "sess-1", "ls")
        repo.enqueue("vm-2", "sess-2", "pwd")
        service = CommandService(repo)

        commands = service.fetch_pending_commands("vm-1")

        assert commands == [
            {"command_id": "cmd-1", "session_id": "sess-1", "payload": "ls"}
        ]

    def test_report_delivery_transitions_state_and_calls_session_updater(self) -> None:
        repo = FakeCommandRepo()
        updater = FakeSessionUpdater()
        service = CommandService(repo, updater)
        command = repo.enqueue("vm-1", "sess-1", "ls")

        updated = service.report_delivery(command.command_id, False, "boom")

        assert updated.state == CommandState.failed
        assert updated.failure_reason == "boom"
        assert updated.delivered_at is not None
        assert updater.calls == [("vm-1", "sess-1", "failed")]

    def test_get_command_detail_returns_full_lifecycle(self) -> None:
        repo = FakeCommandRepo()
        command = repo.enqueue("vm-1", "sess-1", "ls")
        repo.update_state(
            command.command_id,
            "delivered",
            delivered_at="2026-06-26T00:00:01+00:00",
        )
        service = CommandService(repo)

        detail = service.get_command_detail(command.command_id)

        assert detail == {
            "command_id": command.command_id,
            "state": "delivered",
            "target": "vm-1:sess-1",
            "payload": "ls",
            "accepted_at": "2026-06-26T00:00:00+00:00",
            "delivered_at": "2026-06-26T00:00:01+00:00",
            "failure_reason": None,
        }
