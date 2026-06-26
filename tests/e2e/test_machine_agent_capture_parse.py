"""Story 2.1 — E2E integration tests for machine agent capture/parse pipeline.

Validates the full capture → parse pipeline including graceful degradation
when tmux is unavailable, correct SessionSnapshot fields, diff tracking,
stable_counter behaviour, preview truncation, and heartbeat contract shape.
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MACHINE_SRC = REPO / "apps" / "machine-agent" / "src"


def _run_agent_script(script: str) -> str:
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(MACHINE_SRC),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Script failed (rc={result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result.stdout.strip()


def test_machine_agent_imports_resolve():
    """All machine-agent modules must import without errors."""
    _run_agent_script(
        "from capture.tmux_capture import capture_panes\n"
        "from capture.context_extractor import extract_cwd, extract_label\n"
        "from parse.signals import compute_diff_pct, compute_stable_counter\n"
        "from parse.capture_parser import parse_sessions, CaptureState, SessionSnapshot\n"
        "print('OK')\n"
    )


def test_capture_panes_returns_empty_without_tmux():
    """AC4 — When tmux is unavailable, capture_panes returns [] without crashing."""
    output = _run_agent_script(
        "from unittest.mock import patch\n"
        "import subprocess\n"
        "from capture.tmux_capture import capture_panes\n"
        "\n"
        "with patch('subprocess.run', side_effect=FileNotFoundError('tmux not found')):\n"
        "    result = capture_panes()\n"
        "    assert isinstance(result, list), 'Expected list'\n"
        "    assert len(result) == 0, 'Expected empty list when tmux unavailable'\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_extract_cwd_returns_none_without_tmux():
    """AC4 — When tmux is unavailable, extract_cwd returns None without crashing."""
    output = _run_agent_script(
        "from capture.context_extractor import extract_cwd\n"
        "result = extract_cwd('test:0.0')\n"
        "assert result is None, 'Expected None when tmux unavailable'\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_produces_correct_session_snapshot_fields():
    """AC1 — parse_sessions produces SessionSnapshot objects with all required fields."""
    output = _run_agent_script(
        "import json\n"
        "from datetime import datetime, timezone\n"
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "panes = [{'target': 'miniwa:0.0', 'text': 'ls -la\\nDocuments\\n'}]\n"
        "state = CaptureState()\n"
        "snapshots, new_state = parse_sessions(panes, state)\n"
        "\n"
        "assert len(snapshots) == 1\n"
        "snap = snapshots[0]\n"
        "\n"
        "# Required fields\n"
        "assert snap.session_id == 'miniwa:0.0'\n"
        "assert snap.label == 'miniwa'\n"
        "assert isinstance(snap.preview, str)\n"
        "assert snap.cwd is None  # No tmux available\n"
        "assert snap.diff_pct == 100.0  # First capture, old_text is ''\n"
        "assert snap.stable_counter == 0  # diff_pct > 1.0 threshold\n"
        "assert snap.seconds_since_change == 0\n"
        "\n"
        "# captured_at must be ISO 8601 UTC\n"
        "dt = datetime.fromisoformat(snap.captured_at)\n"
        "assert dt.tzinfo is not None, 'captured_at must have timezone'\n"
        "assert dt.tzinfo == timezone.utc, 'captured_at must be UTC'\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_identical_captures_produce_zero_diff():
    """AC2 — Identical captures produce diff_pct == 0.0 and stable_counter increments."""
    output = _run_agent_script(
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "text = 'identical content!'\n"
        "panes = [{'target': 'sess:0.0', 'text': text}]\n"
        "\n"
        "# First call: empty state -> diff_pct = 100.0, counter = 0\n"
        "state = CaptureState()\n"
        "snap1, state = parse_sessions(panes, state)\n"
        "assert snap1[0].diff_pct == 100.0\n"
        "assert snap1[0].stable_counter == 0\n"
        "\n"
        "# Second call: same text -> diff_pct = 0.0, counter increments\n"
        "snap2, state = parse_sessions(panes, state)\n"
        "assert snap2[0].diff_pct == 0.0\n"
        "assert snap2[0].stable_counter == 1\n"
        "assert snap2[0].seconds_since_change == 1  # 1 * interval(1)\n"
        "\n"
        "# Third call: still same -> counter keeps incrementing\n"
        "snap3, state = parse_sessions(panes, state)\n"
        "assert snap3[0].diff_pct == 0.0\n"
        "assert snap3[0].stable_counter == 2\n"
        "assert snap3[0].seconds_since_change == 2\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_differing_captures_reset_counter():
    """AC3 — Differing captures produce diff_pct > 0.0 and stable_counter resets to 0."""
    output = _run_agent_script(
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "# First capture establishes baseline\n"
        "panes = [{'target': 'sess:0.0', 'text': 'hello world'}]\n"
        "state = CaptureState()\n"
        "snap1, state = parse_sessions(panes, state)\n"
        "\n"
        "# Second capture: different text -> diff_pct > 0, counter resets\n"
        "panes[0]['text'] = 'goodbye world'\n"
        "snap2, state = parse_sessions(panes, state)\n"
        "assert snap2[0].diff_pct > 0.0, 'Expected diff_pct > 0 for different text'\n"
        "assert snap2[0].stable_counter == 0, 'Counter should reset on change'\n"
        "assert snap2[0].seconds_since_change == 0\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_preview_truncation():
    """Preview must be truncated to 2000 characters."""
    output = _run_agent_script(
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "long_text = 'a' * 5000\n"
        "panes = [{'target': 'sess:0.0', 'text': long_text}]\n"
        "state = CaptureState()\n"
        "snapshots, _ = parse_sessions(panes, state)\n"
        "\n"
        "assert len(snapshots[0].preview) == 2000, 'Preview must be truncated to 2000 chars'\n"
        "assert snapshots[0].preview == 'a' * 2000\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_preserves_short_text():
    """Short text must not be truncated."""
    output = _run_agent_script(
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "panes = [{'target': 'sess:0.0', 'text': 'short text'}]\n"
        "state = CaptureState()\n"
        "snapshots, _ = parse_sessions(panes, state)\n"
        "\n"
        "assert snapshots[0].preview == 'short text'\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_parse_sessions_multiple_panes():
    """Multiple panes are all parsed independently."""
    output = _run_agent_script(
        "from parse.capture_parser import parse_sessions, CaptureState\n"
        "\n"
        "panes = [\n"
        "    {'target': 'sess1:0.0', 'text': 'pane one'},\n"
        "    {'target': 'sess2:0.1', 'text': 'pane two'},\n"
        "]\n"
        "state = CaptureState()\n"
        "snapshots, state = parse_sessions(panes, state)\n"
        "\n"
        "assert len(snapshots) == 2\n"
        "assert snapshots[0].session_id == 'sess1:0.0'\n"
        "assert snapshots[1].session_id == 'sess2:0.1'\n"
        "\n"
        "# Second call: same text, both stable\n"
        "snapshots2, state = parse_sessions(panes, state)\n"
        "assert snapshots2[0].diff_pct == 0.0\n"
        "assert snapshots2[1].diff_pct == 0.0\n"
        "assert snapshots2[0].stable_counter == 1\n"
        "assert snapshots2[1].stable_counter == 1\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"


def test_snapshot_matches_heartbeat_contract():
    """Snapshot field names match the heartbeat payload contract."""
    output = _run_agent_script(
        "from parse.capture_parser import SessionSnapshot\n"
        "\n"
        "snap = SessionSnapshot(\n"
        "    session_id='miniwa:0.0',\n"
        "    label='miniwa',\n"
        "    preview='ls -la',\n"
        "    cwd='/home/user',\n"
        "    diff_pct=0.0,\n"
        "    stable_counter=5,\n"
        "    seconds_since_change=12,\n"
        "    captured_at='2026-06-24T08:15:00Z',\n"
        ")\n"
        "\n"
        "# All contract fields present and typed correctly\n"
        "assert isinstance(snap.session_id, str)\n"
        "assert isinstance(snap.label, str)\n"
        "assert isinstance(snap.preview, str)\n"
        "assert isinstance(snap.cwd, str) or snap.cwd is None\n"
        "assert isinstance(snap.diff_pct, float)\n"
        "assert isinstance(snap.stable_counter, int)\n"
        "assert isinstance(snap.seconds_since_change, int)\n"
        "assert isinstance(snap.captured_at, str)\n"
        "\n"
        "print('OK')\n"
    )
    assert output == "OK"
