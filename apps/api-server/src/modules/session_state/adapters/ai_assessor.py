from __future__ import annotations

import json
import logging
from typing import override
from urllib.parse import urljoin
from urllib.request import Request as HttpRequest
from urllib.request import urlopen

from modules.session_state.application.ports import (
    AssessmentResult,
    ISessionAssessor,
)
from modules.session_state.domain.session import Assessment, Session
from modules.session_state.domain.snapshot import Snapshot

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """You are a session state assessor. Given the following session information, classify the session into exactly one of these categories:

- stuck: The process appears to be hung or stuck with no progress.
- waiting: The process is waiting for input or a response.
- running: The process is actively running and making progress.
- finished: The process has completed or is not stuck.

Respond with only a JSON object: {"classification": "stuck|waiting|running|finished", "reason": "short explanation"}"""


def _build_payload(session: Session, snapshot: Snapshot | None) -> dict[str, object]:
    preview = snapshot.preview if snapshot else ""
    return {
        "model": "",
        "messages": [
            {"role": "system", "content": CLASSIFICATION_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Session: {session.label}\\n"
                    f"Status: {session.status}\\n"
                    f"Idle (seconds): {session.seconds_since_change}\\n"
                    f"Preview:\\n{preview}"
                ),
            },
        ],
        "temperature": 0.1,
    }


def _normalize_provider_base_url(base_url: str, provider_type: str) -> str:
    normalized = base_url.strip().rstrip("/")
    suffix_by_provider = {
        "openai-compatible": "/v1",
        "anthropic-compatible": "/v1",
        "gemini-compatible": "/v1",
        "9router-compatible": "/v1",
        "ollama-compatible": "/api",
    }
    suffix = suffix_by_provider.get(provider_type)
    if suffix and normalized.lower().endswith(suffix):
        return normalized[: -len(suffix)] or normalized
    return normalized


def _build_provider_url(base_url: str, provider_type: str) -> str:
    endpoint = "/v1/chat/completions"
    if provider_type == "ollama-compatible":
        endpoint = "/api/chat"
    normalized_base_url = _normalize_provider_base_url(base_url, provider_type)
    return urljoin(f"{normalized_base_url}/", endpoint.lstrip("/"))


def _redact_secret(text: str, secret: str) -> str:
    if not secret:
        return text
    return text.replace(secret, "[redacted]")


def _parse_response(body: bytes) -> AssessmentResult:
    data = json.loads(body)
    choices = data.get("choices", [])
    if choices:
        content = choices[0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")
    if not content:
        return AssessmentResult(Assessment.running, "No response from provider")
    try:
        parsed = json.loads(content)
        classification = parsed.get("classification", "running")
        reason = parsed.get("reason", "")
    except (json.JSONDecodeError, KeyError, TypeError):
        classification = "running"
        reason = "Could not parse provider response"
    try:
        assessment = Assessment(classification)
    except ValueError:
        assessment = Assessment.running
    return AssessmentResult(assessment, reason)


class HttpProviderAssessor(ISessionAssessor):
    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        model: str = "",
        provider_type: str = "openai-compatible",
    ) -> None:
        self.base_url = _normalize_provider_base_url(base_url, provider_type)
        self.api_key = api_key
        self.model = model
        self.provider_type = provider_type

    @override
    def assess_session(
        self, session: Session, snapshot: Snapshot | None
    ) -> AssessmentResult:
        url = _build_provider_url(self.base_url, self.provider_type)
        payload = _build_payload(session, snapshot)
        payload["model"] = self.model or "gpt-4o-mini"

        headers: dict[str, str] = {
            "Content-Type": "application/json",
        }
        if self.provider_type == "anthropic-compatible":
            headers["anthropic-version"] = "2023-06-01"
            if self.api_key:
                headers["x-api-key"] = self.api_key
        elif self.provider_type == "gemini-compatible":
            if self.api_key:
                headers["x-goog-api-key"] = self.api_key
        elif self.provider_type == "ollama-compatible":
            # Local Ollama-compatible endpoints usually do not need API keys.
            # Do not send a stored key unnecessarily.
            pass
        elif self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        logger.info(
            "Assessing session %s via %s provider_type=%s model=%s",
            session.session_id,
            self.base_url,
            self.provider_type,
            self.model,
        )

        body_bytes = json.dumps(payload).encode("utf-8")
        req = HttpRequest(url, data=body_bytes, headers=headers, method="POST")

        try:
            with urlopen(req, timeout=30) as resp:
                response_body = resp.read()
        except Exception as exc:
            redacted_error = _redact_secret(str(exc), self.api_key)
            logger.warning("Provider assessor call failed: %s", redacted_error)
            return AssessmentResult(Assessment.running, f"Provider error: {redacted_error}")

        return _parse_response(response_body)
