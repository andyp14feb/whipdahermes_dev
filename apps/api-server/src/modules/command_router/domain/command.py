from __future__ import annotations

from enum import Enum

from sqlmodel import Field, SQLModel


class CommandState(str, Enum):
    accepted = "accepted"
    delivered = "delivered"
    failed = "failed"


class Command(SQLModel, table=True):
    __tablename__ = "commands"

    command_id: str = Field(primary_key=True)
    session_id: str
    machine_id: str
    payload: str
    state: CommandState
    target: str
    requested_at: str
    accepted_at: str | None = None
    delivered_at: str | None = None
    failure_reason: str | None = None
