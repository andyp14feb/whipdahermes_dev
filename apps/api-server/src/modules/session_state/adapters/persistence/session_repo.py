from __future__ import annotations

from sqlalchemy import delete as sa_delete
from sqlalchemy.pool import StaticPool
from sqlmodel import Session as SQLSession, SQLModel, create_engine, select

from modules.session_state.application.ports import ISessionRepo
from modules.session_state.domain.session import Session
from modules.session_state.domain.snapshot import Snapshot

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

        with self.engine.connect() as conn:
            dbapi_conn = conn.connection.driver_connection
            cursor = dbapi_conn.cursor()
            cursor.execute(f"PRAGMA table_info({session_table})")
            existing_columns = {row[1] for row in cursor.fetchall()}

            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    cursor.execute(
                        f"ALTER TABLE {session_table} ADD COLUMN {column_name} {column_type}"
                    )
            dbapi_conn.commit()

    def upsert(self, session: Session) -> None:
        with SQLSession(self.engine) as db:
            db.merge(session)
            db.commit()

    def get(self, session_id: str) -> Session | None:
        with SQLSession(self.engine) as db:
            return db.get(SessionModel, session_id)

    def list_by_machine(self, machine_id: str) -> list[Session]:
        with SQLSession(self.engine) as db:
            statement = select(SessionModel).where(
                SessionModel.machine_id == machine_id
            )
            return list(db.exec(statement).all())

    def list_all(self) -> list[Session]:
        with SQLSession(self.engine) as db:
            statement = select(SessionModel)
            return list(db.exec(statement).all())

    def append_snapshot(self, snapshot: Snapshot) -> None:
        with SQLSession(self.engine) as db:
            db.add(snapshot)
            db.flush()
            db.commit()

    def get_latest_snapshot(self, session_id: str) -> Snapshot | None:
        with SQLSession(self.engine) as db:
            statement = (
                select(SnapshotModel)
                .where(SnapshotModel.session_id == session_id)
                .order_by(SnapshotModel.snapshot_id.desc())
                .limit(1)
            )
            return db.exec(statement).first()

    def update_status(self, session_id: str, status: str) -> None:
        with SQLSession(self.engine) as db:
            session = db.get(SessionModel, session_id)
            if session is None:
                return
            session.status = status
            db.add(session)
            db.commit()

    def update_assessment(
        self,
        session_id: str,
        assessment: str,
        reason: str,
        assessed_at: str,
    ) -> None:
        with SQLSession(self.engine) as db:
            session = db.get(SessionModel, session_id)
            if session is None:
                return
            session.ai_assessment = assessment
            session.ai_assessment_reason = reason
            session.ai_assessed_at = assessed_at
            db.add(session)
            db.commit()

    def delete_all_by_machine(self, machine_id: str) -> None:
        with SQLSession(self.engine) as db:
            db.exec(sa_delete(SnapshotModel).where(SnapshotModel.machine_id == machine_id))
            db.exec(sa_delete(SessionModel).where(SessionModel.machine_id == machine_id))
            db.commit()

    def delete_missing_by_machine(self, machine_id: str, session_ids: set[str]) -> None:
        if not session_ids:
            self.delete_all_by_machine(machine_id)
            return

        with SQLSession(self.engine) as db:
            stale_sessions = select(SessionModel.session_id).where(
                SessionModel.machine_id == machine_id,
                SessionModel.session_id.not_in(session_ids),
            )
            stale_session_ids = list(db.exec(stale_sessions).all())
            if not stale_session_ids:
                return

            db.exec(sa_delete(SnapshotModel).where(SnapshotModel.session_id.in_(stale_session_ids)))
            db.exec(sa_delete(SessionModel).where(SessionModel.session_id.in_(stale_session_ids)))
            db.commit()


def create_session_engine(url: str = "sqlite:///./whipai.db", **engine_kwargs):
    if url == "sqlite://":
        default_kwargs = {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    else:
        default_kwargs = {}

    return create_engine(url, **(default_kwargs | engine_kwargs))
