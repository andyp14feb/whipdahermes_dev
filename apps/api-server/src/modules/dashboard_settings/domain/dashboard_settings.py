from __future__ import annotations

from sqlmodel import Field, SQLModel


class DashboardSettings(SQLModel, table=True):
    __tablename__ = "dashboard_settings"

    settings_key: str = Field(primary_key=True)
    value_json: str
    updated_at: str
