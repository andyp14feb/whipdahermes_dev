from __future__ import annotations

import asyncio
from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from modules.detection.detection import create_detection_module
from modules.ingest.ingest import register_ingest_module
from modules.machine_registry.adapters.persistence.machine_repo import (
    SQLMachineRepo,
    create_machine_engine,
)
from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.application.stale_detector import StaleDetector
from modules.query_api.application.query_service import QueryService
from modules.query_api.adapters.http.assess_router import create_assess_router
from modules.query_api.query_api import create_query_api_router
from modules.session_state.adapters.persistence.session_repo import (
    SQLSessionRepo,
)
from modules.command_router.adapters.persistence.command_repo import (
    SQLCommandRepo,
)
from modules.command_router.application.command_service import CommandService
from modules.command_router.command_router import create_command_router_module
from modules.session_state.session_state import create_session_state_module
from modules.shared_kernel.config import Settings


settings = Settings.load()
app = FastAPI(title="WhipAI API Server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

database_url = settings.database_url.get_secret_value()
shared_engine = create_machine_engine(database_url)
machine_repo = SQLMachineRepo(shared_engine)
machine_service = MachineService(machine_repo)

session_repo = SQLSessionRepo(shared_engine)
machine_repo.delete_deprecated_local_machine_rows()
session_repo.delete_deprecated_local_machine_sessions()
detection_service = create_detection_module()
session_service = create_session_state_module(session_repo, detection_service)

register_ingest_module(
    app,
    machine_registry_upserter=machine_service,
    session_upserter=session_service,
)

command_repo = SQLCommandRepo(shared_engine)
command_service = CommandService(command_repo, session_result_updater=session_service)
app.include_router(create_command_router_module(command_service))

query_service = QueryService(
    machine_reader=machine_repo,
    session_reader=session_repo,
    stale_timeout_seconds=settings.stale_timeout_seconds,
    delete_session=session_service.delete_session_by_id,
    delete_machine=machine_service.delete_machine,
    delete_sessions_by_machine=session_repo.delete_all_by_machine,
)
app.include_router(create_query_api_router(query_service))
app.include_router(create_assess_router(session_service, None))

stale_detector = StaleDetector(
    machine_service=machine_service,
    session_repo=session_repo,
    stale_timeout_seconds=settings.stale_timeout_seconds,
    cleanup_timeout_seconds=settings.cleanup_timeout_seconds,
)
_sweep_task: asyncio.Task[None] | None = None


@app.on_event("startup")
async def start_stale_sweeper() -> None:
    global _sweep_task

    async def sweep_loop() -> None:
        interval = max(1, settings.stale_timeout_seconds // 2)
        while True:
            await asyncio.to_thread(stale_detector.sweep)
            await asyncio.sleep(interval)

    _sweep_task = asyncio.create_task(sweep_loop())


@app.on_event("shutdown")
async def stop_stale_sweeper() -> None:
    global _sweep_task

    if _sweep_task is None:
        return
    _sweep_task.cancel()
    with suppress(asyncio.CancelledError):
        await _sweep_task
    _sweep_task = None


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
