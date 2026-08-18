import logging
import os
import sys
import threading

from config import load_config
from functools import partial

from heartbeat.heartbeat_client import HeartbeatClient
from heartbeat.scheduler import HeartbeatScheduler
from capture.atch_capture import capture_sessions as capture_atch_sessions
from capture.tmux_capture import capture_panes
from parse.capture_parser import parse_sessions
from command.command_poller import CommandPoller
from command.executor import AgentControlState, CommandExecutor
from command.command_reporter import CommandReporter
from command.command_scheduler import CommandScheduler

logger = logging.getLogger(__name__)


def main() -> None:
    config = load_config()
    control_state = AgentControlState.get_instance()
    control_state.clear_shutdown()
    control_state.clear_restart()
    control_state.start_updates()

    client = HeartbeatClient(config.api_url)
    capture_fns = []
    if "tmux" in config.session_backends:
        capture_fns.append(partial(capture_panes, config.tmux_socket))
    if "atch" in config.session_backends:
        capture_fns.append(capture_atch_sessions)

    def capture_fn():
        return [session for provider in capture_fns for session in provider()]
    heartbeat_scheduler = HeartbeatScheduler(config, client, capture_fn, parse_sessions)

    poller = CommandPoller(config.api_url)
    executor = CommandExecutor(config.tmux_socket)
    reporter = CommandReporter(config.api_url)
    command_scheduler = CommandScheduler(config, poller, executor, reporter)

    heartbeat_thread = threading.Thread(target=heartbeat_scheduler.run_forever, daemon=True)
    command_thread = threading.Thread(target=command_scheduler.run_forever, daemon=True)
    heartbeat_thread.start()
    command_thread.start()

    try:
        heartbeat_thread.join()
        command_thread.join()
    except KeyboardInterrupt:
        logger.info("Shutting down...")

    if control_state.restart_requested():
        logger.info("Restarting machine agent process")
        os.execv(sys.executable, [sys.executable, *sys.argv])


if __name__ == "__main__":
    main()
