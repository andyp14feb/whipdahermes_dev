from __future__ import annotations

from sqlalchemy import delete as sa_delete, event
from sqlalchemy.pool import QueuePool, StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from modules.machine_registry.application.ports import IMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock


MachineModel = Machine
DEPRECATED_LOCAL_MACHINE_ID = "vm-local"
REAL_WORKER_PREFIX = "worker-"


class SQLMachineRepo(IMachineRepo):
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def upsert(self, machine: Machine, db: Session | None = None) -> None:
        if db is not None:
            db.merge(machine)
            return
        with sqlite_write_lock(), Session(self.engine) as session:
            session.merge(machine)
            session.commit()

    def get(self, machine_id: MachineId) -> Machine | None:
        with Session(self.engine) as session:
            return session.get(MachineModel, str(machine_id))

    def list_all(self) -> list[Machine]:
        with Session(self.engine) as session:
            statement = select(MachineModel).where(MachineModel.machine_id != DEPRECATED_LOCAL_MACHINE_ID)
            return list(session.exec(statement).all())

    def delete_by_id(self, machine_id: str) -> None:
        self.delete(machine_id)

    def delete_deprecated_local_machine_rows(self) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            real_worker_exists = session.exec(
                select(MachineModel.machine_id).where(MachineModel.machine_id.like(f"{REAL_WORKER_PREFIX}%"))
            ).first() is not None
            if not real_worker_exists:
                return
            session.exec(sa_delete(MachineModel).where(MachineModel.machine_id == DEPRECATED_LOCAL_MACHINE_ID))
            session.commit()

    def update_session_count(self, machine_id: MachineId, count: int) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            machine = session.get(MachineModel, str(machine_id))
            if machine is None:
                return
            machine.session_count = count
            session.add(machine)
            session.commit()

    def mark_stale(self, machine_id: MachineId) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            machine = session.get(MachineModel, str(machine_id))
            if machine is None:
                return
            machine.is_stale = True
            session.add(machine)
            session.commit()

    def delete(self, machine_id: MachineId) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            stmt = sa_delete(MachineModel).where(MachineModel.machine_id == str(machine_id))
            session.exec(stmt)
            session.commit()


def _sqlite_engine_kwargs(url: str) -> dict[str, object]:
    if url == "sqlite://":
        return {
            "connect_args": {
                "check_same_thread": False,
                "timeout": 10,
                "isolation_level": None,
            },
            "poolclass": StaticPool,
        }
    if url.startswith("sqlite"):
        return {
            "connect_args": {
                "check_same_thread": False,
                "timeout": 5,
                "isolation_level": None,
            },
            "poolclass": QueuePool,
            "pool_size": 5,
            "max_overflow": 5,
        }
    return {}


def _configure_sqlite_engine(engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_machine_engine(url: str = "sqlite:///./whipai.db", **engine_kwargs):
    engine = create_engine(url, **(_sqlite_engine_kwargs(url) | engine_kwargs))
    _configure_sqlite_engine(engine)
    return engine
