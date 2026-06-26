from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.ingest.ingest import register_ingest_module
from modules.machine_registry.adapters.persistence.machine_repo import (
    SQLMachineRepo,
    create_machine_engine,
)
from modules.machine_registry.application.machine_service import MachineService
from modules.machine_registry.machine_registry import create_machine_registry_module


class _PlaceholderSessionUpserter:
    def upsert_from_heartbeat(
        self, machine_id, sessions: list[SessionSnapshot]
    ) -> None:
        pass


app = FastAPI(title="WhipAI API Server", version="0.1.0")

machine_engine = create_machine_engine()
machine_repo = SQLMachineRepo(machine_engine)
machine_service = MachineService(machine_repo)

register_ingest_module(
    app,
    machine_registry_upserter=machine_service,
    session_upserter=_PlaceholderSessionUpserter(),
)
app.include_router(create_machine_registry_module(machine_service))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
