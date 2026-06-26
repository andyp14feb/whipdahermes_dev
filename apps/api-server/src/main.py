from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from modules.shared_kernel.ids import MachineId
from modules.ingest.domain.heartbeat_payload import SessionSnapshot
from modules.ingest.ingest import register_ingest_module


class _PlaceholderMachineRegistry:
    def upsert_machine(self, machine_id: MachineId, last_seen_at: str) -> None:
        pass


class _PlaceholderSessionUpserter:
    def upsert_from_heartbeat(
        self, machine_id: MachineId, sessions: list[SessionSnapshot]
    ) -> None:
        pass


app = FastAPI(title="WhipAI API Server", version="0.1.0")

register_ingest_module(
    app,
    machine_registry_upserter=_PlaceholderMachineRegistry(),
    session_upserter=_PlaceholderSessionUpserter(),
)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
