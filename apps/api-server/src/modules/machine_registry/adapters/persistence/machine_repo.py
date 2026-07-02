from __future__ import annotations

from sqlalchemy import delete as sa_delete, event
from sqlalchemy.pool import NullPool, StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from modules.machine_registry.application.ports import IMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock


MachineModel = Machine


class SQLMachineRepo(IMachineRepo):
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def upsert(self, machine: Machine) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            session.merge(machine)
            session.commit()

    def get(self, machine_id: MachineId) -> Machine | None:
        with Session(self.engine) as session:
            return session.get(MachineModel, str(machine_id))

    def list_all(self) -> list[Machine]:
        with Session(self.engine) as session:
            statement = select(MachineModel)
            return list(session.exec(statement).all())

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
                "timeout": 30,
                "isolation_level": None,
            },
            "poolclass": NullPool,
        }
    return {}


def _configure_sqlite_engine(engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_machine_engine(url: str = "sqlite:///./whipai.db", **engine_kwargs):
    engine = create_engine(url, **(_sqlite_engine_kwargs(url) | engine_kwargs))
    _configure_sqlite_engine(engine)
    return engine
