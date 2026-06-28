from parse.capture_parser import CaptureState, PREVIEW_MAX_CHARS, parse_sessions


def test_parse_sessions_creates_snapshots(monkeypatch):
    monkeypatch.setattr("parse.capture_parser._now_utc_iso", lambda: "2026-06-24T08:15:00Z")

    panes = [{"target": "miniwa:0.0", "text": "hello world", "cwd": "/tmp/project"}]
    snapshots, state = parse_sessions(panes, CaptureState())

    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot.session_id == "miniwa:0.0"
    assert snapshot.label == "miniwa"
    assert snapshot.preview == "hello world"
    assert snapshot.cwd == "/tmp/project"
    assert snapshot.diff_pct > 0.0
    assert snapshot.stable_counter == 0
    assert snapshot.seconds_since_change == 0
    assert snapshot.captured_at == "2026-06-24T08:15:00Z"
    assert state.previous_captures == {"miniwa:0.0": "hello world"}
    assert state.previous_counters == {"miniwa:0.0": 0}


def test_parse_sessions_tracks_state_across_calls(monkeypatch):
    monkeypatch.setattr("parse.capture_parser._now_utc_iso", lambda: "2026-06-24T08:15:00Z")

    panes = [{"target": "miniwa:0.0", "text": "steady output", "cwd": "/tmp/project"}]
    first_snapshots, first_state = parse_sessions(panes, CaptureState(), interval=3)
    second_snapshots, second_state = parse_sessions(panes, first_state, interval=3)

    assert first_snapshots[0].diff_pct > 0.0
    assert first_snapshots[0].stable_counter == 0
    assert second_snapshots[0].diff_pct == 0.0
    assert second_snapshots[0].stable_counter == 1
    assert second_snapshots[0].seconds_since_change == 3
    assert second_state.previous_captures == {"miniwa:0.0": "steady output"}
    assert second_state.previous_counters == {"miniwa:0.0": 1}


def test_parse_sessions_resets_stability_on_change(monkeypatch):
    monkeypatch.setattr("parse.capture_parser._now_utc_iso", lambda: "2026-06-24T08:15:00Z")

    initial_state = CaptureState(
        previous_captures={"miniwa:0.0": "old output"},
        previous_counters={"miniwa:0.0": 4},
    )
    panes = [{"target": "miniwa:0.0", "text": "new output", "cwd": None}]
    snapshots, state = parse_sessions(panes, initial_state, interval=5)

    assert snapshots[0].diff_pct > 0.0
    assert snapshots[0].stable_counter == 0
    assert snapshots[0].seconds_since_change == 0
    assert state.previous_counters == {"miniwa:0.0": 0}


def test_parse_sessions_tracks_stability_per_pane_independently(monkeypatch):
    monkeypatch.setattr("parse.capture_parser._now_utc_iso", lambda: "2026-06-24T08:15:00Z")

    initial_state = CaptureState(
        previous_captures={
            "pane-a": "steady output",
            "pane-b": "old output",
        },
        previous_counters={
            "pane-a": 3,
            "pane-b": 4,
        },
    )
    panes = [
        {"target": "pane-a", "text": "steady output", "cwd": "/tmp/a"},
        {"target": "pane-b", "text": "new output", "cwd": "/tmp/b"},
    ]

    snapshots, state = parse_sessions(panes, initial_state, interval=3)
    by_id = {snapshot.session_id: snapshot for snapshot in snapshots}

    assert by_id["pane-a"].stable_counter == 4
    assert by_id["pane-a"].seconds_since_change == 12
    assert by_id["pane-b"].stable_counter == 0
    assert by_id["pane-b"].seconds_since_change == 0
    assert state.previous_counters == {"pane-a": 4, "pane-b": 0}


def test_parse_sessions_truncates_preview(monkeypatch):
    monkeypatch.setattr("parse.capture_parser._now_utc_iso", lambda: "2026-06-24T08:15:00Z")

    text = "a" * (PREVIEW_MAX_CHARS + 50)
    panes = [{"target": "miniwa:0.0", "text": text, "cwd": "/tmp/project"}]
    snapshots, _ = parse_sessions(panes, CaptureState())

    assert len(snapshots[0].preview) == PREVIEW_MAX_CHARS
    assert snapshots[0].preview == text[-PREVIEW_MAX_CHARS:]


def test_now_utc_iso_ends_with_z():
    from parse.capture_parser import _now_utc_iso
    ts = _now_utc_iso()
    assert ts.endswith("Z"), f"captured_at should end with Z, got: {ts}"
    assert "T" in ts, f"missing ISO 8601 date/time separator, got: {ts}"
