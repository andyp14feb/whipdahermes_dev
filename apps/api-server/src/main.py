from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from modules.ingest.ingest import register_ingest_module
from modules.machine_registry.adapters.persistence.machine_repo import (
    SQLMachineRepo,
    create_machine_engine,
)
from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.machine_registry import create_machine_registry_module
from modules.session_state.adapters.persistence.session_repo import (
    SQLSessionRepo,
    create_session_engine,
)
from modules.session_state.session_state import create_session_state_module


app = FastAPI(title="WhipAI API Server", version="0.1.0")

machine_engine = create_machine_engine()
machine_repo = SQLMachineRepo(machine_engine)
machine_service = MachineService(machine_repo)

session_engine = create_session_engine()
session_repo = SQLSessionRepo(session_engine)
session_service = create_session_state_module(session_repo)

register_ingest_module(
    app,
    machine_registry_upserter=machine_service,
    session_upserter=session_service,
)
app.include_router(create_machine_registry_module(machine_service))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
