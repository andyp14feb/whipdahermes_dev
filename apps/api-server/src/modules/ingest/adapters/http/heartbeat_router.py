from __future__ import annotations

from fastapi import APIRouter

from modules.ingest.application.heartbeat_service import HeartbeatService
from modules.ingest.domain.heartbeat_payload import HeartbeatPayload


def create_heartbeat_router(service: HeartbeatService) -> APIRouter:
    router = APIRouter(tags=["ingest"])

    @router.post("/heartbeat")
    def post_heartbeat(payload: HeartbeatPayload):
        accepted = service.process_heartbeat(payload)
        return {"ok": True, "accepted": accepted}

    return router

