from __future__ import annotations

import logging
from dataclasses import asdict
from urllib.parse import urljoin

import requests

from parse.capture_parser import SessionSnapshot

logger = logging.getLogger(__name__)


class HeartbeatClient:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")

    def _url(self, path: str) -> str:
        return urljoin(f"{self.api_url}/", path.lstrip("/"))

    def is_api_available(self) -> bool:
        url = self._url("health")
        try:
            response = requests.get(url, timeout=5)
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

        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        except requests.RequestException as exc:
            logger.warning("Failed to POST heartbeat for machine_id=%s to %s: %s", machine_id, url, exc)
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
