from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from modules.command_router.application.command_service import CommandService
from modules.dashboard_settings.adapters.persistence.dashboard_settings_repo import (
    SQLDashboardSettingsRepo,
)
from modules.dashboard_settings.adapters.persistence.nudge_runtime_repo import (
    SQLNudgeRuntimeRepo,
)
from modules.session_state.application.ports import ISessionRepo
from modules.shared_kernel.time_utils import now_utc


DEFAULT_NUDGE_PROMPT = "Please continue if you are waiting for input."
ELIGIBLE_STATUSES = {"stable", "waiting", "waiting_input", "stuck"}


@dataclass(frozen=True)
class NudgeTickResult:
    checked_sessions: int
    sent_nudges: int


class BackgroundNudger:
    def __init__(
        self,
        settings_repo: SQLDashboardSettingsRepo,
        runtime_repo: SQLNudgeRuntimeRepo,
        session_repo: ISessionRepo,
        command_service: CommandService,
        interval_seconds: int = 5,
    ) -> None:
        self.settings_repo = settings_repo
        self.runtime_repo = runtime_repo
        self.session_repo = session_repo
        self.command_service = command_service
        self.interval_seconds = max(1, interval_seconds)
        self._task: asyncio.Task[None] | None = None
        self._last_started_at: str | None = None
        self._last_stopped_at: str | None = None
        self._last_tick_at: str | None = None
        self._last_error: str | None = None
        self._last_checked_sessions = 0
        self._last_sent_nudges = 0

    def start(self) -> bool:
        if self.is_running:
            return False
        self._last_started_at = now_utc()
        self._last_stopped_at = None
        self._task = asyncio.create_task(self._run(), name="background-nudger")
        return True

    async def stop(self) -> bool:
        if self._task is None or self._task.done():
            self._task = None
            self._last_stopped_at = now_utc()
            return False
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        self._last_stopped_at = now_utc()
        return True

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    def status(self) -> dict[str, Any]:
        return {
            "running": self.is_running,
            "task_name": self._task.get_name() if self._task is not None else None,
            "interval_seconds": self.interval_seconds,
            "last_started_at": self._last_started_at,
            "last_stopped_at": self._last_stopped_at,
            "last_tick_at": self._last_tick_at,
            "last_error": self._last_error,
            "last_checked_sessions": self._last_checked_sessions,
            "last_sent_nudges": self._last_sent_nudges,
        }

    async def _run(self) -> None:
        while True:
            try:
                result = await asyncio.to_thread(self.tick)
                self._last_checked_sessions = result.checked_sessions
                self._last_sent_nudges = result.sent_nudges
                self._last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._last_error = str(exc)
            await asyncio.sleep(self.interval_seconds)

    def tick(self) -> NudgeTickResult:
        self._last_tick_at = now_utc()
        settings = self.settings_repo.get() or {}
        nudges_by_session = settings.get("nudgesBySession")
        if not isinstance(nudges_by_session, dict):
            return NudgeTickResult(checked_sessions=0, sent_nudges=0)

        sessions = {
            f"{session.machine_id}:{session.session_id}": session
            for session in self.session_repo.list_all()
        }
        sent = 0

        for session_key, raw_config in nudges_by_session.items():
            if not isinstance(raw_config, dict):
                continue
            session = sessions.get(session_key)
            if session is None:
                continue

            config = _normalize_nudge_config(raw_config)
            if config is None:
                continue
            if not _is_eligible(session.status, session.seconds_since_change, config):
                continue

            stable_bucket = session.seconds_since_change // config["stableTimeSeconds"]
            if stable_bucket < 1:
                continue
            if stable_bucket <= config["nudgesSent"]:
                continue

            runtime_state = self.runtime_repo.get(session_key)
            if (
                runtime_state is not None
                and runtime_state.last_bucket == stable_bucket
                and runtime_state.last_status == session.status
            ):
                continue

            prompt = str(config["customPrompt"]).strip() or DEFAULT_NUDGE_PROMPT
            try:
                command = self.command_service.enqueue_command(
                    machine_id=session.machine_id,
                    session_id=session.session_id,
                    payload=prompt,
                )
            except Exception as exc:
                self.runtime_repo.mark_error(
                    session_key=session_key,
                    machine_id=session.machine_id,
                    session_id=session.session_id,
                    bucket=stable_bucket,
                    status=session.status,
                    error=str(exc),
                )
                continue

            next_sent = min(config["nudgesSent"] + 1, config["maxNudges"])
            updated_config = {
                **config,
                "nudgesSent": next_sent,
                "enabled": config["enabled"] and next_sent < config["maxNudges"],
            }
            self.settings_repo.update_nudge_config(session_key, updated_config)
            self.runtime_repo.mark_sent(
                session_key=session_key,
                machine_id=session.machine_id,
                session_id=session.session_id,
                bucket=stable_bucket,
                status=session.status,
                command_id=command.command_id,
            )
            sent += 1

        return NudgeTickResult(
            checked_sessions=len(nudges_by_session),
            sent_nudges=sent,
        )


def _normalize_nudge_config(config: dict[str, Any]) -> dict[str, Any] | None:
    enabled = config.get("enabled")
    stable_time_seconds = config.get("stableTimeSeconds")
    max_nudges = config.get("maxNudges")
    nudges_sent = config.get("nudgesSent", 0)
    custom_prompt = config.get("customPrompt", DEFAULT_NUDGE_PROMPT)

    if not isinstance(enabled, bool):
        return None
    if not isinstance(stable_time_seconds, int) or stable_time_seconds < 1:
        return None
    if not isinstance(max_nudges, int) or max_nudges < 1:
        return None
    if not isinstance(nudges_sent, int) or nudges_sent < 0:
        return None
    if not isinstance(custom_prompt, str):
        custom_prompt = DEFAULT_NUDGE_PROMPT

    return {
        "enabled": enabled,
        "stableTimeSeconds": stable_time_seconds,
        "maxNudges": max_nudges,
        "nudgesSent": min(nudges_sent, max_nudges),
        "customPrompt": custom_prompt,
    }


def _is_eligible(
    status: str,
    seconds_since_change: int,
    config: dict[str, Any],
) -> bool:
    return (
        config["enabled"]
        and status in ELIGIBLE_STATUSES
        and seconds_since_change >= config["stableTimeSeconds"]
        and config["nudgesSent"] < config["maxNudges"]
    )
