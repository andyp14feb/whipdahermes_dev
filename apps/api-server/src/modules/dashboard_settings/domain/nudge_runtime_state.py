from __future__ import annotations

from sqlmodel import Field, SQLModel


class NudgeRuntimeState(SQLModel, table=True):
    __tablename__ = "nudge_runtime_state"

    session_key: str = Field(primary_key=True)
    machine_id: str
    session_id: str
    last_bucket: int
    last_status: str
    last_command_id: str | None = None
    last_error: str | None = None
    updated_at: str
