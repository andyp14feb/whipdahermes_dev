from __future__ import annotations

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

    def update_status(self, session_id: str, status: str) -> None:
        with SQLSession(self.engine) as db:
            session = db.get(SessionModel, session_id)
            if session is None:
                return
            session.status = status
            db.add(session)
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
