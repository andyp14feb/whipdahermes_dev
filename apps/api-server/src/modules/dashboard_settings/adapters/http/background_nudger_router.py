from __future__ import annotations

from fastapi import APIRouter

from modules.dashboard_settings.application.background_nudger import BackgroundNudger


def create_background_nudger_router(nudger: BackgroundNudger) -> APIRouter:
    router = APIRouter(prefix="/dashboard/nudger", tags=["dashboard-nudger"])

    @router.get("/status")
    def get_nudger_status() -> dict[str, object]:
        return nudger.status()

    @router.post("/start")
    async def start_nudger() -> dict[str, object]:
        started = nudger.start()
        return {"started": started, **nudger.status()}

    @router.post("/stop")
    async def stop_nudger() -> dict[str, object]:
        stopped = await nudger.stop()
        return {"stopped": stopped, **nudger.status()}

    return router
