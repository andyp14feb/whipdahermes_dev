from __future__ import annotations

import logging
import time
from dataclasses import asdict
from urllib.parse import urljoin

import requests

from parse.capture_parser import SessionSnapshot

logger = logging.getLogger(__name__)

HEARTBEAT_TIMEOUT_SECONDS = 10
HEARTBEAT_MAX_ATTEMPTS = 3
HEARTBEAT_RETRY_BACKOFF_SECONDS = 0.5
RETRYABLE_STATUS_CODES = {500, 502, 503, 504}


class HeartbeatClient:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")
        self.session = requests.Session()

    def _url(self, path: str) -> str:
        return urljoin(f"{self.api_url}/", path.lstrip("/"))

    def is_api_available(self) -> bool:
        url = self._url("health")
        try:
            response = self.session.get(url, timeout=5)
        except requests.RequestException as exc:
            logger.warning("API health check failed at %s: %s", url, exc)
            return False

        if response.status_code != 200:
            logger.warning("API health check failed at %s: HTTP %s", url, response.status_code)
            return False

        return True

    def post_heartbeat(self, machine_id: str, sessions: list[SessionSnapshot]) -> bool:
        payload = {
            "machine_id": machine_id,
            "sessions": [asdict(session) for session in sessions],
        }
        url = self._url("heartbeat")

        response = self._post_with_retry(url, payload, machine_id)
        if response is None:
            return False

        if response.status_code == 404:
            logger.warning("Heartbeat endpoint not found for machine_id=%s at %s", machine_id, url)
            return False

        if response.status_code == 422:
            logger.warning("Heartbeat validation failed for machine_id=%s: %s", machine_id, response.text)
            return False

        if response.status_code != 200:
            logger.warning("Heartbeat request failed for machine_id=%s to %s: HTTP %s", machine_id, url, response.status_code)
            return False

        try:
            data = response.json()
        except ValueError:
            logger.warning("Heartbeat response invalid JSON for machine_id=%s to %s", machine_id, url)
            return False

        if data.get("ok") is True:
            return True

        logger.warning("Heartbeat response rejected for machine_id=%s to %s: %s", machine_id, url, data)
        return False

    def _post_with_retry(self, url: str, payload: dict, machine_id: str) -> requests.Response | None:
        """POST with a short retry for transient failures (connection errors,
        timeouts, 5xx). Non-transient outcomes (4xx, malformed responses) are
        not retried here — they're handled by the caller."""
        last_exc: requests.RequestException | None = None
        response: requests.Response | None = None

        for attempt in range(1, HEARTBEAT_MAX_ATTEMPTS + 1):
            try:
                response = self.session.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=HEARTBEAT_TIMEOUT_SECONDS,
                )
            except requests.RequestException as exc:
                last_exc = exc
                response = None
            else:
                last_exc = None
                if response.status_code not in RETRYABLE_STATUS_CODES:
                    return response

            if attempt < HEARTBEAT_MAX_ATTEMPTS:
                time.sleep(HEARTBEAT_RETRY_BACKOFF_SECONDS * attempt)

        if last_exc is not None:
            logger.warning(
                "Failed to POST heartbeat for machine_id=%s to %s after %d attempts: %s",
                machine_id, url, HEARTBEAT_MAX_ATTEMPTS, last_exc,
            )
            return None

        return response
