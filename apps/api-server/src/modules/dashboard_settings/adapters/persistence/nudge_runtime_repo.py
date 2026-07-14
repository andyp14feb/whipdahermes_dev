from __future__ import annotations

from sqlmodel import Session, SQLModel

from modules.dashboard_settings.domain.nudge_runtime_state import NudgeRuntimeState
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock
from modules.shared_kernel.time_utils import now_utc


NudgeRuntimeStateModel = NudgeRuntimeState


class SQLNudgeRuntimeRepo:
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def get(self, session_key: str) -> NudgeRuntimeState | None:
        with Session(self.engine) as session:
            return session.get(NudgeRuntimeStateModel, session_key)

    def mark_sent(
        self,
        session_key: str,
        machine_id: str,
        session_id: str,
        bucket: int,
        status: str,
        command_id: str,
    ) -> None:
        row = NudgeRuntimeState(
            session_key=session_key,
            machine_id=machine_id,
            session_id=session_id,
            last_bucket=bucket,
            last_status=status,
            last_command_id=command_id,
            last_error=None,
            updated_at=now_utc(),
        )
        with sqlite_write_lock(), Session(self.engine) as session:
            session.merge(row)
            session.commit()

    def mark_error(
        self,
        session_key: str,
        machine_id: str,
        session_id: str,
        bucket: int,
        status: str,
        error: str,
    ) -> None:
        row = NudgeRuntimeState(
            session_key=session_key,
            machine_id=machine_id,
            session_id=session_id,
            last_bucket=bucket,
            last_status=status,
            last_command_id=None,
            last_error=error,
            updated_at=now_utc(),
        )
        with sqlite_write_lock(), Session(self.engine) as session:
            session.merge(row)
            session.commit()
