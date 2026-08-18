from __future__ import annotations

import logging
import time

from command.executor import AgentControlState

logger = logging.getLogger(__name__)


class CommandScheduler:
    def __init__(self, config, poller, executor, reporter):
        self.config = config
        self.poller = poller
        self.executor = executor
        self.reporter = reporter

    def run_once(self) -> None:
        commands = self.poller.fetch_pending(self.config.machine_id)
        if not commands:
            logger.debug("No pending commands for machine_id=%s", self.config.machine_id)
            return

        logger.info("Processing %s command(s) for machine_id=%s", len(commands), self.config.machine_id)
        for command in commands:
            logger.info(
                "Executing command_id=%s session_id=%s payload=%s",
                command.command_id,
                command.session_id,
                command.payload,
            )
            result = self.executor.execute(command)
            delivered = self.reporter.report(result)
            if delivered:
                logger.info(
                    "Command delivery confirmed for command_id=%s", command.command_id
                )
            else:
                logger.warning(
                    "Command delivery report failed for command_id=%s",
                    command.command_id,
                )

    def run_forever(self):
        logger.info(
            "Starting command scheduler for machine_id=%s api_url=%s interval=%s",
            self.config.machine_id,
            self.config.api_url,
            self.config.command_poll_interval,
        )
        control_state = AgentControlState.get_instance()
        while not control_state.shutdown_requested() and not control_state.restart_requested():
            try:
                self.run_once()
                time.sleep(self.config.command_poll_interval)
            except (KeyboardInterrupt, SystemExit):
                logger.info(
                    "Command scheduler shutting down gracefully for machine_id=%s",
                    self.config.machine_id,
                )
                break
