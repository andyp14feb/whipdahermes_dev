from __future__ import annotations

import logging

import requests

from command.executor import ExecutionResult

logger = logging.getLogger(__name__)


class CommandReporter:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")

    def report(self, result: ExecutionResult) -> bool:
        url = f"{self.api_url}/commands/{result.command_id}/delivery"
        payload = {
            "delivered": result.delivered,
            "failure_reason": result.failure_reason,
        }
        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        except requests.RequestException as exc:
            logger.warning(
                "Failed to report delivery for command_id=%s to %s: %s",
                result.command_id,
                url,
                exc,
            )
            return False

        if response.status_code != 200:
            logger.warning(
                "Delivery report failed for command_id=%s to %s: HTTP %s",
                result.command_id,
                url,
                response.status_code,
            )
            return False

        return True
