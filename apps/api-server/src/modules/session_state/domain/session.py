from __future__ import annotations

from sqlmodel import Field, SQLModel


class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    session_id: str = Field(primary_key=True)
    machine_id: str = Field(index=True)
    label: str
    status: str = "unknown"
    seconds_since_change: int = 0
    last_seen_at: str
    cwd: str = ""
