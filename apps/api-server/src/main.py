from __future__ import annotations

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
from modules.machine_registry.machine_registry import create_machine_registry_module
from modules.query_api.application.query_service import QueryService
from modules.query_api.query_api import create_query_api_router
from modules.session_state.adapters.persistence.session_repo import (
    SQLSessionRepo,
    create_session_engine,
)
from modules.command_router.adapters.persistence.command_repo import (
    SQLCommandRepo,
    create_command_engine,
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
machine_engine = create_machine_engine(database_url)
machine_repo = SQLMachineRepo(machine_engine)
machine_service = MachineService(machine_repo)

session_engine = create_session_engine(database_url)
session_repo = SQLSessionRepo(session_engine)
detection_service = create_detection_module()
session_service = create_session_state_module(session_repo, detection_service)

register_ingest_module(
    app,
    machine_registry_upserter=machine_service,
    session_upserter=session_service,
)
create_machine_registry_module(machine_service)

command_engine = create_command_engine(database_url)
command_repo = SQLCommandRepo(command_engine)
command_service = CommandService(command_repo, session_result_updater=session_service)
app.include_router(create_command_router_module(command_service))

query_service = QueryService(machine_reader=machine_repo, session_reader=session_repo)
app.include_router(create_query_api_router(query_service))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
