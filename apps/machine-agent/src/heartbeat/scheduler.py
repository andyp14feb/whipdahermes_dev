from __future__ import annotations

import logging
import time

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
        self.state = CaptureState()

    def run_once(self) -> bool:
        if not AgentControlState.get_instance().updates_enabled():
            logger.info("Heartbeat updates paused for machine_id=%s", self.config.machine_id)
            return True
        panes = self.capture_fn()
        snapshots, self.state = self.parse_fn(panes, self.state, interval=self.config.interval)
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
