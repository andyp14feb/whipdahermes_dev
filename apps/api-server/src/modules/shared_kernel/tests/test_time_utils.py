import pytest
from datetime import datetime, timezone
from modules.shared_kernel.time_utils import now_utc, parse_iso


class TestNowUtc:
    def test_returns_iso_string(self) -> None:
        result = now_utc()
        assert isinstance(result, str)
        assert "T" in result
        assert result.endswith("+00:00") or "+00:" in result

    def test_is_recent(self) -> None:
        before = datetime.now(tz=timezone.utc)
        result = now_utc()
        after = datetime.now(tz=timezone.utc)
        parsed = parse_iso(result)
        assert before <= parsed <= after


class TestParseIso:
    def test_normalizes_to_utc(self) -> None:
        dt = parse_iso("2025-01-15T10:30:00+02:00")
        assert dt.tzinfo is not None
        assert dt.utcoffset().total_seconds() == 0
        assert dt.hour == 8
    def test_parses_utc_iso(self) -> None:
        dt = parse_iso("2025-01-15T10:30:00+00:00")
        assert dt.year == 2025
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30
        assert dt.tzinfo is not None
        assert dt.tzinfo.utcoffset(dt) == timezone.utc.utcoffset(dt)

    def test_parses_naive_iso_as_utc(self) -> None:
        dt = parse_iso("2025-01-15T10:30:00")
        assert dt.tzinfo is not None
        assert dt.tzinfo.utcoffset(dt) == timezone.utc.utcoffset(dt)

    def test_roundtrip(self) -> None:
        original = "2025-06-01T12:00:00+00:00"
        parsed = parse_iso(original)
        assert parsed.isoformat() == original

    def test_invalid_raises(self) -> None:
        with pytest.raises(ValueError):
            parse_iso("not-a-date")
