from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy import delete as sa_delete, inspect
from sqlmodel import Session as SQLSession, SQLModel, create_engine, select

from modules.machine_registry.adapters.persistence.machine_repo import (
    DEPRECATED_LOCAL_MACHINE_ID,
    REAL_WORKER_PREFIX,
    MachineModel,
    _configure_sqlite_engine,
    _sqlite_engine_kwargs,
)
from modules.session_state.application.ports import ISessionRepo
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock
from modules.shared_kernel.time_utils import parse_iso

SessionModel = Session
SnapshotModel = Snapshot


class SQLSessionRepo(ISessionRepo):
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)
        self._ensure_session_columns()

    def _ensure_session_columns(self) -> None:
        if self.engine.url.get_backend_name() != "sqlite":
            return

        session_table = SessionModel.__tablename__
        required_columns = {
            "ai_assessment": "TEXT",
            "ai_assessment_reason": "TEXT",
            "ai_assessed_at": "TEXT",
        }

        with sqlite_write_lock(), self.engine.connect() as conn:
            dbapi_conn = conn.connection.driver_connection
            cursor = dbapi_conn.cursor()
            cursor.execute(f"PRAGMA table_info({session_table})")
            table_info = cursor.fetchall()
            existing_columns = {row[1] for row in table_info}

            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    cursor.execute(
                        f"ALTER TABLE {session_table} ADD COLUMN {column_name} {column_type}"
                    )
                    existing_columns.add(column_name)

            primary_key_columns = [row[1] for row in sorted(table_info, key=lambda row: row[5]) if row[5] > 0]
            if primary_key_columns == ["session_id"]:
                cursor.execute("ALTER TABLE sessions RENAME TO sessions_legacy")
                cursor.execute(
                    """
                    CREATE TABLE sessions (
                        machine_id VARCHAR NOT NULL,
                        session_id VARCHAR NOT NULL,
                        label VARCHAR NOT NULL,
                        status VARCHAR NOT NULL,
                        seconds_since_change INTEGER NOT NULL,
                        last_seen_at VARCHAR NOT NULL,
                        cwd VARCHAR NOT NULL,
                        ai_assessment TEXT,
                        ai_assessment_reason TEXT,
                        ai_assessed_at TEXT,
                        PRIMARY KEY (machine_id, session_id)
                    )
                    """
                )
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_sessions_machine_id ON sessions (machine_id)")
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO sessions (
                        machine_id, session_id, label, status, seconds_since_change,
                        last_seen_at, cwd, ai_assessment, ai_assessment_reason, ai_assessed_at
                    )
                    SELECT
                        machine_id, session_id, label, status, seconds_since_change,
                        last_seen_at, cwd, ai_assessment, ai_assessment_reason, ai_assessed_at
                    FROM sessions_legacy
                    """
                )
                cursor.execute("DROP TABLE sessions_legacy")
            dbapi_conn.commit()

    def upsert(self, session: Session) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            db.merge(session)
            db.commit()

    def batch_upsert_heartbeat(
        self,
        machine_id: str,
        active_session_ids: set[str],
        records: list[tuple[Session, Snapshot]],
    ) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            missing_stmt = select(SessionModel).where(
                SessionModel.machine_id == machine_id
            )
            if active_session_ids:
                missing_stmt = missing_stmt.where(
                    SessionModel.session_id.not_in(active_session_ids)
                )
            missing_session_ids = [
                session.session_id for session in db.exec(missing_stmt).all()
            ]
            if missing_session_ids:
                db.exec(
                    sa_delete(SnapshotModel).where(
                        SnapshotModel.machine_id == machine_id,
                        SnapshotModel.session_id.in_(missing_session_ids),
                    )
                )
                db.exec(
                    sa_delete(SessionModel).where(
                        SessionModel.machine_id == machine_id,
                        SessionModel.session_id.in_(missing_session_ids),
                    )
                )
            for session, snapshot in records:
                db.merge(session)
                db.add(snapshot)
            db.commit()

    def get(self, machine_id: str, session_id: str) -> Session | None:
        with SQLSession(self.engine) as db:
            return db.get(SessionModel, (machine_id, session_id))

    def list_by_machine(self, machine_id: str) -> list[Session]:
        with SQLSession(self.engine) as db:
            statement = select(SessionModel).where(
                SessionModel.machine_id == machine_id
            )
            return list(db.exec(statement).all())

    def list_all(self) -> list[Session]:
        with SQLSession(self.engine) as db:
            statement = select(SessionModel).where(
                SessionModel.machine_id != DEPRECATED_LOCAL_MACHINE_ID
            )
            return list(db.exec(statement).all())

    def delete_deprecated_local_machine_sessions(self) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            real_worker_exists = db.exec(
                select(MachineModel.machine_id).where(
                    MachineModel.machine_id.like(f"{REAL_WORKER_PREFIX}%")
                )
            ).first() is not None
            if not real_worker_exists:
                return
            db.exec(
                sa_delete(SnapshotModel).where(SnapshotModel.machine_id == DEPRECATED_LOCAL_MACHINE_ID)
            )
            db.exec(
                sa_delete(SessionModel).where(SessionModel.machine_id == DEPRECATED_LOCAL_MACHINE_ID)
            )
            db.commit()

    def append_snapshot(self, machine_id: str, snapshot: Snapshot) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            db.add(snapshot)
            db.flush()
            db.commit()

    def get_latest_snapshot(self, machine_id: str, session_id: str) -> Snapshot | None:
        with SQLSession(self.engine) as db:
            statement = (
                select(SnapshotModel)
                .where(
                    SnapshotModel.machine_id == machine_id,
                    SnapshotModel.session_id == session_id,
                )
                .order_by(SnapshotModel.snapshot_id.desc())
                .limit(1)
            )
            return db.exec(statement).first()

    def update_status(self, machine_id: str, session_id: str, status: str) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            session = db.get(SessionModel, (machine_id, session_id))
            if session is None:
                return
            session.status = status
            db.add(session)
            db.commit()

    def update_assessment(
        self,
        machine_id: str,
        session_id: str,
        assessment: str,
        reason: str,
        assessed_at: str,
    ) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            session = db.get(SessionModel, (machine_id, session_id))
            if session is None:
                return
            session.ai_assessment = assessment
            session.ai_assessment_reason = reason
            session.ai_assessed_at = assessed_at
            db.add(session)
            db.commit()

    def delete_all_by_machine(self, machine_id: str) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            db.exec(sa_delete(SnapshotModel).where(SnapshotModel.machine_id == machine_id))
            db.exec(sa_delete(SessionModel).where(SessionModel.machine_id == machine_id))
            db.commit()

    def mark_missing_by_machine_as_stale(self, machine_id: str, session_ids: set[str]) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            if not session_ids:
                # machine sent heartbeat with zero sessions => mark ALL as stale
                sessions = list(
                    db.exec(select(SessionModel).where(SessionModel.machine_id == machine_id)).all()
                )
                for session in sessions:
                    session.status = "stale"
                    db.add(session)
                db.commit()
                return

            stale_sessions = list(
                db.exec(
                    select(SessionModel).where(
                        SessionModel.machine_id == machine_id,
                        SessionModel.session_id.not_in(session_ids),
                    )
                ).all()
            )
            if not stale_sessions:
                return

            for session in stale_sessions:
                session.status = "stale"
                db.add(session)
            db.commit()

    def delete_by_id(self, machine_id: str, session_id: str) -> None:
        with sqlite_write_lock(), SQLSession(self.engine) as db:
            db.exec(sa_delete(SnapshotModel).where(SnapshotModel.machine_id == machine_id, SnapshotModel.session_id == session_id))
            db.exec(sa_delete(SessionModel).where(SessionModel.machine_id == machine_id, SessionModel.session_id == session_id))
            db.commit()

    def delete_sessions_older_than(self, seconds: int) -> None:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(seconds=seconds)
        iso_cutoff = cutoff.isoformat().replace("+00:00", "Z")

        with sqlite_write_lock(), SQLSession(self.engine) as db:
            stale_ids = list(
                db.exec(
                    select(SessionModel.session_id).where(
                        SessionModel.last_seen_at < iso_cutoff
                    )
                ).all()
            )
            if not stale_ids:
                return
            db.exec(sa_delete(SnapshotModel).where(SnapshotModel.session_id.in_(stale_ids)))
            db.exec(sa_delete(SessionModel).where(SessionModel.session_id.in_(stale_ids)))
            db.commit()


def create_session_engine(url: str = "sqlite:///./whipai.db", **engine_kwargs):
    engine = create_engine(url, **(_sqlite_engine_kwargs(url) | engine_kwargs))
    _configure_sqlite_engine(engine)
    return engine
