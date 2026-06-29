import subprocess
from unittest.mock import patch

from command.command_poller import Command
from command.executor import AgentControlState, CommandExecutor


def test_execute_sends_payload_to_tmux_session():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="sess:0.0", payload="continue")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "send-keys", "-t", "sess:0.0", "continue", "Enter"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_uses_configured_tmux_socket():
    executor = CommandExecutor("/host-tmux/default")
    command = Command(command_id="cmd-1", session_id="sess:0.0", payload="continue")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    run.assert_called_once_with(
        ["tmux", "-S", "/host-tmux/default", "send-keys", "-t", "sess:0.0", "continue", "Enter"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_reports_called_process_error():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="missing", payload="continue")

    with patch(
        "command.executor.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["tmux"]),
    ):
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is False
    assert result.failure_reason


def test_execute_reports_tmux_missing():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="sess", payload="continue")

    with patch("command.executor.subprocess.run", side_effect=FileNotFoundError):
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is False
    assert result.failure_reason == "tmux not installed"


def test_execute_pause_control_command_without_tmux():
    control_state = AgentControlState.get_instance()
    control_state.start_updates()
    executor = CommandExecutor()
    command = Command(command_id="cmd-pause", session_id="sess", payload="__whipai__:pause")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert control_state.updates_enabled() is False
    run.assert_not_called()


def test_execute_restart_control_command_sets_restart_flag():
    control_state = AgentControlState.get_instance()
    control_state.clear_restart()
    executor = CommandExecutor()
    command = Command(command_id="cmd-restart", session_id="sess", payload="__whipai__:restart")

    result = executor.execute(command)

    assert result.delivered is True
    assert control_state.restart_requested() is True
    control_state.clear_restart()
