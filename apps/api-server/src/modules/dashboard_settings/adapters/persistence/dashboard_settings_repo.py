from __future__ import annotations

import json
from typing import Any

from sqlmodel import Session, SQLModel

from modules.dashboard_settings.domain.dashboard_settings import DashboardSettings
from modules.shared_kernel.sqlite_write_lock import sqlite_write_lock
from modules.shared_kernel.time_utils import now_utc


DASHBOARD_SETTINGS_KEY = "dashboard"
DashboardSettingsModel = DashboardSettings


class SQLDashboardSettingsRepo:
    def __init__(self, engine) -> None:
        self.engine = engine
        SQLModel.metadata.create_all(self.engine)

    def get(self) -> dict[str, Any] | None:
        with Session(self.engine) as session:
            row = session.get(DashboardSettingsModel, DASHBOARD_SETTINGS_KEY)
            if row is None:
                return None
            try:
                value = json.loads(row.value_json)
            except json.JSONDecodeError:
                return None
            return value if isinstance(value, dict) else None

    def put(self, settings: dict[str, Any]) -> None:
        row = DashboardSettings(
            settings_key=DASHBOARD_SETTINGS_KEY,
            value_json=json.dumps(settings, separators=(",", ":")),
            updated_at=now_utc(),
        )
        with sqlite_write_lock(), Session(self.engine) as session:
            session.merge(row)
            session.commit()

    def update_nudge_config(self, session_key: str, config: dict[str, Any]) -> None:
        with sqlite_write_lock(), Session(self.engine) as session:
            row = session.get(DashboardSettingsModel, DASHBOARD_SETTINGS_KEY)
            if row is None:
                settings: dict[str, Any] = {
                    "templateActions": [],
                    "nudgesBySession": {},
                }
                row = DashboardSettings(
                    settings_key=DASHBOARD_SETTINGS_KEY,
                    value_json="{}",
                    updated_at=now_utc(),
                )
            else:
                try:
                    loaded = json.loads(row.value_json)
                except json.JSONDecodeError:
                    loaded = {}
                settings = loaded if isinstance(loaded, dict) else {}

            nudges = settings.get("nudgesBySession")
            if not isinstance(nudges, dict):
                nudges = {}
            nudges[session_key] = config
            settings["nudgesBySession"] = nudges
            settings.setdefault("templateActions", [])
            row.value_json = json.dumps(settings, separators=(",", ":"))
            row.updated_at = now_utc()
            session.merge(row)
            session.commit()
