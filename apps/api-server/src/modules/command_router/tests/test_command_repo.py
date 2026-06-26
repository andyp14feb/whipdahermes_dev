from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from modules.command_router.adapters.persistence.command_repo import SQLCommandRepo
from modules.command_router.domain.command import CommandState
from modules.command_router.domain.command_state import InvalidTransitionError


class TestSQLCommandRepo:
    def create_repo(self) -> SQLCommandRepo:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return SQLCommandRepo(engine)

    def test_enqueue_returns_accepted_command_with_unique_id(self) -> None:
        repo = self.create_repo()

        first = repo.enqueue("vm-1", "sess-1", "ls")
        second = repo.enqueue("vm-1", "sess-1", "pwd")

        assert first.command_id
        assert second.command_id
        assert first.command_id != second.command_id
        assert first.state == CommandState.accepted
        assert first.target == "vm-1:sess-1"
        assert first.accepted_at is not None
        assert first.requested_at is not None

    def test_find_pending_by_machine_returns_only_accepted_commands(self) -> None:
        repo = self.create_repo()
        pending = repo.enqueue("vm-1", "sess-1", "ls")
        delivered = repo.enqueue("vm-1", "sess-2", "pwd")
        repo.update_state(delivered.command_id, "delivered", delivered_at="2026-06-26T00:00:00+00:00")
        repo.enqueue("vm-2", "sess-3", "whoami")

        commands = repo.find_pending_by_machine("vm-1")

        assert [command.command_id for command in commands] == [pending.command_id]

    def test_update_state_transitions_to_delivered_and_failed(self) -> None:
        repo = self.create_repo()
        delivered = repo.enqueue("vm-1", "sess-1", "ls")
        failed = repo.enqueue("vm-1", "sess-2", "pwd")

        updated_delivered = repo.update_state(
            delivered.command_id,
            "delivered",
            delivered_at="2026-06-26T00:00:00+00:00",
        )
        updated_failed = repo.update_state(
            failed.command_id,
            "failed",
            delivered_at="2026-06-26T00:00:01+00:00",
            failure_reason="boom",
        )

        assert updated_delivered.state == CommandState.delivered
        assert updated_delivered.delivered_at == "2026-06-26T00:00:00+00:00"
        assert updated_failed.state == CommandState.failed
        assert updated_failed.failure_reason == "boom"

    def test_update_state_rejects_invalid_transition(self) -> None:
        repo = self.create_repo()
        command = repo.enqueue("vm-1", "sess-1", "ls")
        repo.update_state(command.command_id, "delivered", delivered_at="2026-06-26T00:00:00+00:00")

        from pytest import raises

        with raises(InvalidTransitionError):
            repo.update_state(command.command_id, "accepted")
