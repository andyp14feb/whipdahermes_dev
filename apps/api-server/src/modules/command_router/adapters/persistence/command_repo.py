from __future__ import annotations

from sqlmodel import Session, SQLModel, create_engine, select

from modules.machine_registry.adapters.persistence.machine_repo import (
    _configure_sqlite_engine,
    _sqlite_engine_kwargs,
)
from modules.command_router.application.ports import ICommandRepo
from modules.command_router.domain.command import Command, CommandState
from modules.command_router.domain.command_state import CommandStateMachine
from modules.shared_kernel.ids import CommandId
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock
from modules.shared_kernel.time_utils import now_utc


CommandModel = Command


class SQLCommandRepo(ICommandRepo):
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def enqueue(self, machine_id: str, session_id: str, payload: str) -> Command:
        now = now_utc()
        command_id = str(CommandId.generate())
        target = f"{machine_id}:{session_id}"
        command = Command(
            command_id=command_id,
            session_id=session_id,
            machine_id=machine_id,
            payload=payload,
            state=CommandState.accepted,
            target=target,
            requested_at=now,
            accepted_at=now,
        )
        with sqlite_write_lock(), Session(self.engine) as session:
            session.add(command)
            session.commit()
            session.refresh(command)
        return command

    def find_by_id(self, command_id: str) -> Command | None:
        with Session(self.engine) as session:
            return session.get(CommandModel, command_id)

    def find_pending_by_machine(self, machine_id: str) -> list[Command]:
        statement = select(CommandModel).where(
            CommandModel.machine_id == machine_id,
            CommandModel.state == CommandState.accepted,
        )
        with Session(self.engine) as session:
            return list(session.exec(statement).all())

    def update_state(
        self,
        command_id: str,
        state: str,
        **kwargs: object,
    ) -> Command:
        with sqlite_write_lock(), Session(self.engine) as session:
            command = session.get(CommandModel, command_id)
            if command is None:
                raise ValueError(f"Command {command_id} not found")
            target_state = CommandState(state)
            command.state = CommandStateMachine.transition(command.state, target_state)
            for key, value in kwargs.items():
                setattr(command, key, value)
            session.add(command)
            session.commit()
            session.refresh(command)
        return command


def create_command_engine(url: str = "sqlite://", **engine_kwargs):
    engine = create_engine(url, **(_sqlite_engine_kwargs(url) | engine_kwargs))
    _configure_sqlite_engine(engine)
    return engine
