from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from capture.tmux_capture import capture_panes
from command.executor import AgentControlState
from parse.capture_parser import CaptureState, parse_sessions

logger = logging.getLogger(__name__)


class HeartbeatScheduler:
    def __init__(self, config, client, capture_fn, parse_fn):
        self.config = config
        self.client = client
        self.capture_fn = capture_fn
        self.parse_fn = parse_fn
        self.state_path = Path(f"/tmp/whipai-capture-state-{self.config.machine_id}.json")
        self.state = self._load_state()

    def _load_state(self) -> CaptureState:
        if not self.state_path.exists():
            return CaptureState()

        try:
            payload = json.loads(self.state_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning(
                "Failed to load capture state for machine_id=%s path=%s error=%s",
                self.config.machine_id,
                self.state_path,
                exc,
            )
            return CaptureState()

        previous_captures = payload.get("previous_captures")
        previous_counters = payload.get("previous_counters")

        if not isinstance(previous_captures, dict) or not isinstance(previous_counters, dict):
            logger.warning(
                "Invalid capture state format for machine_id=%s path=%s",
                self.config.machine_id,
                self.state_path,
            )
            return CaptureState()

        return CaptureState(
            previous_captures={str(key): str(value) for key, value in previous_captures.items()},
            previous_counters={str(key): int(value) for key, value in previous_counters.items()},
        )

    def _save_state(self) -> None:
        payload = {
            "previous_captures": self.state.previous_captures,
            "previous_counters": self.state.previous_counters,
        }

        try:
            self.state_path.write_text(json.dumps(payload))
        except OSError as exc:
            logger.warning(
                "Failed to save capture state for machine_id=%s path=%s error=%s",
                self.config.machine_id,
                self.state_path,
                exc,
            )

    def run_once(self) -> bool:
        if not AgentControlState.get_instance().updates_enabled():
            logger.info("Heartbeat updates paused for machine_id=%s", self.config.machine_id)
            return True
        panes = self.capture_fn()
        snapshots, self.state = self.parse_fn(panes, self.state, interval=self.config.interval)
        self._save_state()
        success = self.client.post_heartbeat(self.config.machine_id, snapshots)
        if not success:
            logger.error("Heartbeat post failed for machine_id=%s", self.config.machine_id)
        return success

    def run_forever(self):
        logger.info(
            "Starting heartbeat scheduler for machine_id=%s api_url=%s interval=%s",
            self.config.machine_id,
            self.config.api_url,
            self.config.interval,
        )
        control_state = AgentControlState.get_instance()
        while not control_state.shutdown_requested() and not control_state.restart_requested():
            try:
                self.run_once()
                time.sleep(self.config.interval)
            except (KeyboardInterrupt, SystemExit):
                logger.info("Heartbeat scheduler shutting down gracefully for machine_id=%s", self.config.machine_id)
                break
