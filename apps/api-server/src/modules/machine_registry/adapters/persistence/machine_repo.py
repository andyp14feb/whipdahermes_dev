from __future__ import annotations

from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

from modules.machine_registry.application.ports import IMachineRepo
from modules.machine_registry.domain.machine import Machine
from modules.shared_kernel.ids import MachineId


MachineModel = Machine


class SQLMachineRepo(IMachineRepo):
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def upsert(self, machine: Machine) -> None:
        with Session(self.engine) as session:
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
        with Session(self.engine) as session:
            machine = session.get(MachineModel, str(machine_id))
            if machine is None:
                return
            machine.session_count = count
            session.add(machine)
            session.commit()

    def mark_stale(self, machine_id: MachineId) -> None:
        with Session(self.engine) as session:
            machine = session.get(MachineModel, str(machine_id))
            if machine is None:
                return
            machine.is_stale = True
            session.add(machine)
            session.commit()


def create_machine_engine(url: str = "sqlite:///./whipai.db", **engine_kwargs):
    if url == "sqlite://":
        default_kwargs = {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    else:
        default_kwargs = {}

    return create_engine(url, **(default_kwargs | engine_kwargs))
