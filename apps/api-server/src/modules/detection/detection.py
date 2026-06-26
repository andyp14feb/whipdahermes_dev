from __future__ import annotations

from modules.detection.application.detection_service import DetectionService


def create_detection_module(
    stale_timeout_seconds: int = 60,
) -> DetectionService:
    return DetectionService(stale_timeout_seconds=stale_timeout_seconds)
