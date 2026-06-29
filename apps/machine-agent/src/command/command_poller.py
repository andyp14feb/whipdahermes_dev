from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)


@dataclass
class Command:
    command_id: str
    session_id: str
    payload: str


class CommandPoller:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")

    def _url(self, path: str) -> str:
        return urljoin(f"{self.api_url}/", path.lstrip("/"))

    def fetch_pending(self, machine_id: str) -> list[Command]:
        url = self._url(f"commands/{machine_id}")
        try:
            response = requests.get(url, timeout=10)
        except requests.RequestException as exc:
            logger.warning("Failed to fetch commands for machine_id=%s from %s: %s", machine_id, url, exc)
            return []

        if response.status_code == 422:
            logger.warning("Command fetch validation failed for machine_id=%s: %s", machine_id, response.text)
            return []

        if response.status_code == 404:
            logger.warning("Command fetch endpoint not found for machine_id=%s at %s", machine_id, url)
            return []

        if response.status_code != 200:
            logger.warning("Command fetch failed for machine_id=%s from %s: HTTP %s", machine_id, url, response.status_code)
            return []

        try:
            data = response.json()
        except ValueError:
            logger.warning("Command fetch response invalid JSON for machine_id=%s from %s", machine_id, url)
            return []

        commands_raw = data.get("commands", [])
        if not isinstance(commands_raw, list):
            logger.warning("Command fetch response 'commands' is not a list for machine_id=%s", machine_id)
            return []

        commands: list[Command] = []
        for item in commands_raw:
            if not isinstance(item, dict):
                continue
            command_id = item.get("command_id", "")
            session_id = item.get("session_id", "")
            payload = item.get("payload", "")
            if command_id and session_id:
                commands.append(Command(command_id=command_id, session_id=session_id, payload=payload))
        return commands
