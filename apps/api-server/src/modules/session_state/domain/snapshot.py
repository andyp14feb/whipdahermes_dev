from __future__ import annotations

from sqlmodel import Field, SQLModel


class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshots"

    snapshot_id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    machine_id: str = Field(index=True)
    preview: str
    diff_pct: float = 0.0
    stable_counter: int = 0
    cwd: str = ""
    captured_at: str
