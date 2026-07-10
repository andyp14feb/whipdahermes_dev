from __future__ import annotations

from fastapi import APIRouter, FastAPI

from modules.ingest.adapters.http.heartbeat_router import create_heartbeat_router
from modules.ingest.application.heartbeat_service import HeartbeatService
from modules.ingest.application.ports import IMachineRegistryUpserter, ISessionUpserter


def create_ingest_module(
    machine_registry_upserter: IMachineRegistryUpserter,
    session_upserter: ISessionUpserter,
    engine=None,
) -> APIRouter:
    service = HeartbeatService(
        machine_registry=machine_registry_upserter,
        session_state=session_upserter,
        engine=engine,
    )
    return create_heartbeat_router(service)


def register_ingest_module(
    app: FastAPI,
    machine_registry_upserter: IMachineRegistryUpserter,
    session_upserter: ISessionUpserter,
    engine=None,
) -> None:
    router = create_ingest_module(
        machine_registry_upserter=machine_registry_upserter,
        session_upserter=session_upserter,
        engine=engine,
    )
    app.include_router(router)
