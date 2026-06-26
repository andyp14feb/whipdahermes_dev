from __future__ import annotations

import os
from typing import Self

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="whipai-api", alias="APP_NAME")
    debug: bool = Field(default=False, alias="DEBUG")
    api_token: SecretStr = Field(default="", alias="API_TOKEN")
    heartbeat_interval_seconds: int = Field(default=30, alias="HEARTBEAT_INTERVAL_SECONDS")
    stale_timeout_seconds: int = Field(default=60, alias="STALE_TIMEOUT_SECONDS")
    database_url: SecretStr = Field(default="sqlite:///whipai.db", alias="DATABASE_URL")

    @classmethod
    def load(cls) -> Self:
        return cls()
