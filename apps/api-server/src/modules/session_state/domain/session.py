from __future__ import annotations

from enum import Enum
from sqlmodel import Field, SQLModel


class Assessment(str, Enum):
    stuck = "stuck"
    waiting = "waiting"
    running = "running"
    finished = "finished"


class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    machine_id: str = Field(primary_key=True)
    session_id: str = Field(primary_key=True)
    backend: str = "tmux"
    label: str
    status: str = "unknown"
    seconds_since_change: int = 0
    last_seen_at: str
    cwd: str = ""

    ai_assessment: str | None = Field(default=None)
    ai_assessment_reason: str | None = Field(default=None)
    ai_assessed_at: str | None = Field(default=None)
