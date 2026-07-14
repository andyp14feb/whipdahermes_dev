from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from modules.dashboard_settings.adapters.persistence.dashboard_settings_repo import (
    SQLDashboardSettingsRepo,
)


class TemplateActionPayload(BaseModel):
    id: str
    label: str
    payload: str


class NudgeConfigPayload(BaseModel):
    enabled: bool
    stableTimeSeconds: int = Field(ge=1)
    maxNudges: int = Field(ge=1)
    nudgesSent: int = Field(ge=0)
    customPrompt: str


class DashboardSettingsPayload(BaseModel):
    templateActions: list[TemplateActionPayload] = Field(default_factory=list)
    nudgesBySession: dict[str, NudgeConfigPayload] = Field(default_factory=dict)


def _empty_response(exists: bool) -> dict[str, Any]:
    return {
        "exists": exists,
        "templateActions": [],
        "nudgesBySession": {},
    }


def create_dashboard_settings_router(repo: SQLDashboardSettingsRepo) -> APIRouter:
    router = APIRouter(prefix="/dashboard/settings", tags=["dashboard-settings"])

    @router.get("")
    def get_dashboard_settings() -> dict[str, Any]:
        settings = repo.get()
        if settings is None:
            return _empty_response(False)
        return {
            "exists": True,
            "templateActions": settings.get("templateActions", []),
            "nudgesBySession": settings.get("nudgesBySession", {}),
        }

    @router.put("")
    def put_dashboard_settings(body: DashboardSettingsPayload) -> dict[str, bool]:
        repo.put(body.model_dump())
        return {"ok": True}

    return router
