import os

import requests
from loguru import logger

API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "")


def notify_completion(video_id):
    if not API_BASE_URL or not SERVICE_SECRET:
        logger.warning("Notification skipped | video_id={} reason=API_BASE_URL or SERVICE_SECRET not set", video_id)
        return
    try:
        response = requests.post(
            f"{API_BASE_URL}/internal/send-email",
            json={"videoProcessingId": video_id},
            headers={"x-service-secret": SERVICE_SECRET},
            timeout=10
        )
        response.raise_for_status()
        logger.info("Completion notification sent | video_id={}", video_id)
    except Exception:
        logger.exception("Completion notification failed | video_id={}", video_id)
