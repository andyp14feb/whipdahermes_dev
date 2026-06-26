from __future__ import annotations

from fastapi import APIRouter

from modules.machine_registry.adapters.http.machine_router import create_machine_router
from modules.machine_registry.adapters.persistence.machine_repo import (
    SQLMachineRepo,
    create_machine_engine,
)
from modules.machine_registry.application.machine_service import MachineService


def create_machine_repo(database_url: str = "sqlite:///./whipai.db", **engine_kwargs) -> SQLMachineRepo:
    engine = create_machine_engine(database_url, **engine_kwargs)
    return SQLMachineRepo(engine)


def create_machine_registry_module(service: MachineService) -> APIRouter:
    return create_machine_router(service)
