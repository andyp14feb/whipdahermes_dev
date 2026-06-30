from __future__ import annotations

from modules.session_state.adapters import ai_assessor
from modules.session_state.adapters.ai_assessor import (
    HttpProviderAssessor,
    _build_models_url,
    _build_provider_url,
    _normalize_provider_base_url,
    fetch_provider_models,
)

from modules.session_state.domain.session import Assessment, Session
from modules.session_state.domain.snapshot import Snapshot


class _DummyResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        return self._body


def _session() -> Session:
    return Session(
        session_id="session-1",
        machine_id="machine-1",
        label="tmux:1",
        status="running",
        seconds_since_change=5,
        last_seen_at="2026-06-29T10:00:00Z",
        cwd="/tmp",
    )


def _snapshot() -> Snapshot:
    return Snapshot(
        snapshot_id=1,
        session_id="session-1",
        machine_id="machine-1",
        preview="still working",
        diff_pct=5.0,
        stable_counter=0,
        cwd="/tmp",
        captured_at="2026-06-29T10:00:05Z",
    )


def test_normalize_provider_base_url_strips_duplicate_suffixes() -> None:
    assert _normalize_provider_base_url("https://provider.example/v1/", "openai-compatible") == "https://provider.example"
    assert _normalize_provider_base_url("https://provider.example/v1", "9router-compatible") == "https://provider.example"
    assert _normalize_provider_base_url("http://localhost:11434/api/", "ollama-compatible") == "http://localhost:11434"
    assert _normalize_provider_base_url("https://provider.example", "openai-compatible") == "https://provider.example"


def test_build_provider_url_avoids_duplicate_v1() -> None:
    assert _build_provider_url("https://provider.example/v1", "openai-compatible") == "https://provider.example/v1/chat/completions"
    assert _build_provider_url("https://provider.example", "openai-compatible") == "https://provider.example/v1/chat/completions"
    assert _build_provider_url("http://localhost:11434/api", "ollama-compatible") == "http://localhost:11434/api/chat"


def test_build_models_url_avoids_duplicate_v1() -> None:
    assert _build_models_url("https://provider.example/v1", "openai-compatible") == "https://provider.example/v1/models"
    assert _build_models_url("https://provider.example", "openai-compatible") == "https://provider.example/v1/models"
    assert _build_models_url("http://localhost:11434/api", "ollama-compatible") == "http://localhost:11434/api/tags"


def test_fetch_provider_models_uses_server_side_auth_header(monkeypatch) -> None:
    captured = {}

    def fake_urlopen(request, timeout: int = 15):
        captured["url"] = request.full_url
        captured["authorization"] = request.headers.get("Authorization")
        return _DummyResponse(b'{"data":[{"id":"model-a"},{"id":"model-b"}]}')

    monkeypatch.setattr(ai_assessor, "urlopen", fake_urlopen)

    models = fetch_provider_models(
        "https://provider.example/v1",
        "openai-compatible",
        "super-secret-key",
    )

    assert captured["url"] == "https://provider.example/v1/models"
    assert captured["authorization"] == "Bearer super-secret-key"
    assert models == ["model-a", "model-b"]


def test_assessor_uses_normalized_url_and_bearer_header(monkeypatch) -> None:
    captured = {}

    def fake_urlopen(request, timeout: int = 30):
        captured["url"] = request.full_url
        captured["authorization"] = request.headers.get("Authorization")
        return _DummyResponse(b'{"choices":[{"message":{"content":"{\\"classification\\":\\"finished\\",\\"reason\\":\\"done\\"}"}}]}')

    monkeypatch.setattr(ai_assessor, "urlopen", fake_urlopen)

    assessor = HttpProviderAssessor(
        base_url="https://provider.example/v1",
        api_key="super-secret-key",
        model="model-a",
        provider_type="openai-compatible",
    )

    result = assessor.assess_session(_session(), _snapshot())

    assert captured["url"] == "https://provider.example/v1/chat/completions"
    assert captured["authorization"] == "Bearer super-secret-key"
    assert result.classification == Assessment.finished
    assert result.reason == "done"


def test_assessor_redacts_api_key_from_provider_errors(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int = 30):
        raise RuntimeError("upstream rejected Bearer super-secret-key")

    monkeypatch.setattr(ai_assessor, "urlopen", fake_urlopen)

    assessor = HttpProviderAssessor(
        base_url="https://provider.example/v1",
        api_key="super-secret-key",
        model="model-a",
        provider_type="openai-compatible",
    )

    result = assessor.assess_session(_session(), _snapshot())

    assert result.classification == Assessment.running
    assert "super-secret-key" not in result.reason
    assert "[redacted]" in result.reason


def test_assessor_handles_unparseable_provider_body_without_raising(monkeypatch) -> None:
    def fake_urlopen(request, timeout: int = 30):
        return _DummyResponse(b'{"choices":[{"message":{"content":"{\\"classification\\":\\"running\\",\\"reason\\":\\"ok\\"}"}}]}\ntrailing-garbage')

    monkeypatch.setattr(ai_assessor, "urlopen", fake_urlopen)

    assessor = HttpProviderAssessor(
        base_url="https://provider.example/v1",
        api_key="super-secret-key",
        model="model-a",
        provider_type="openai-compatible",
    )

    result = assessor.assess_session(_session(), _snapshot())

    assert result.classification == Assessment.running
    assert result.reason == "Provider returned unparseable response"
