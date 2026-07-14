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


def test_execute_create_session_runs_tmux_new_session():
    executor = CommandExecutor()
    command = Command(command_id="cmd-create", session_id="", payload="__whipai__:create_session:whipai-new")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "new-session", "-d", "-s", "whipai-new"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_create_session_rejects_invalid_name():
    executor = CommandExecutor()
    command = Command(command_id="cmd-create-bad", session_id="", payload="__whipai__:create_session:")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "invalid session name" in (result.failure_reason or "")
    run.assert_not_called()


def test_execute_rename_session_runs_tmux_rename():
    executor = CommandExecutor()
    command = Command(command_id="cmd-rename", session_id="old", payload="__whipai__:rename_session:old|new-name")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "rename-session", "-t", "old", "new-name"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_rename_session_splits_suffix_once_before_validating_names():
    executor = CommandExecutor()
    command = Command(
        command_id="cmd-rename-extra",
        session_id="old",
        payload="__whipai__:rename_session:old|new|name",
    )

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "invalid new session name" in (result.failure_reason or "")
    run.assert_not_called()


def test_execute_rename_session_rejects_payload_without_new_name():
    executor = CommandExecutor()
    command = Command(command_id="cmd-rename-bad", session_id="old", payload="__whipai__:rename_session:old|")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert result.failure_reason is not None
    run.assert_not_called()


def test_execute_rename_session_rejects_invalid_current_name():
    executor = CommandExecutor()
    command = Command(
        command_id="cmd-rename-bad-current",
        session_id="old",
        payload="__whipai__:rename_session:|new-name"
    )

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "invalid current session target" in (result.failure_reason or "")
    run.assert_not_called()


def test_execute_rename_session_rejects_invalid_new_name():
    executor = CommandExecutor()
    command = Command(
        command_id="cmd-rename-bad-new",
        session_id="old",
        payload="__whipai__:rename_session:old|"
    )

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "invalid new session name" in (result.failure_reason or "")
    run.assert_not_called()


def test_execute_rename_session_accepts_colon_in_new_name():
    executor = CommandExecutor()
    command = Command(
        command_id="cmd-rename-colon",
        session_id="old",
        payload="__whipai__:rename_session:old|0.0:tmuxagent",
    )

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "rename-session", "-t", "old", "0.0:tmuxagent"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_kill_session_runs_tmux_kill_session():
    executor = CommandExecutor()
    command = Command(command_id="cmd-kill", session_id="ignored", payload="__whipai__:kill_session:old")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "kill-session", "-t", "old"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_kill_session_accepts_markdown_alias():
    executor = CommandExecutor()
    command = Command(command_id="cmd-kill-alias", session_id="ignored", payload="**whipai**:kill_session:old")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "kill-session", "-t", "old"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_kill_session_rejects_invalid_name():
    executor = CommandExecutor()
    command = Command(command_id="cmd-kill-bad", session_id="ignored", payload="__whipai__:kill_session:")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "invalid kill session target" in (result.failure_reason or "")
    run.assert_not_called()


def test_execute_unknown_whipai_control_payload_is_not_sent_to_tmux():
    executor = CommandExecutor()
    command = Command(command_id="cmd-unknown-control", session_id="sess:0.0", payload="__whipai__:missing_action")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.delivered is False
    assert "unknown WhipAI control payload" in (result.failure_reason or "")
    run.assert_not_called()
