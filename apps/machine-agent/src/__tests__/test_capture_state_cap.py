from parse.capture_parser import PREVIEW_MAX_CHARS, STATE_TEXT_MAX_CHARS, CaptureState, parse_sessions, _truncate_state_text
from capture.atch_capture import ATCH_TAIL_MAX_CHARS


def test_truncate_state_text_keeps_tail():
    raw = "x" * (STATE_TEXT_MAX_CHARS + 500)
    out = _truncate_state_text(raw)
    assert len(out) == STATE_TEXT_MAX_CHARS
    assert out == raw[-STATE_TEXT_MAX_CHARS:]


def test_parse_sessions_caps_previous_captures():
    huge = "a" * (STATE_TEXT_MAX_CHARS + 1000)
    panes = [{"target": "big:0.0", "text": huge, "backend": "atch", "label": "big"}]
    snapshots, state = parse_sessions(panes, CaptureState(), interval=2)
    assert len(snapshots) == 1
    assert len(snapshots[0].preview) <= PREVIEW_MAX_CHARS
    assert len(state.previous_captures["atch:big:0.0"]) == STATE_TEXT_MAX_CHARS


def test_atch_tail_max_chars_constant():
    assert ATCH_TAIL_MAX_CHARS == 16384


def test_preview_max_chars_matches_atch_tail_budget():
    assert PREVIEW_MAX_CHARS == ATCH_TAIL_MAX_CHARS == 16384
