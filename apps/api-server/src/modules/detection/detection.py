from __future__ import annotations

from modules.detection.application.detection_service import DetectionService


def create_detection_module() -> DetectionService:
    return DetectionService()
