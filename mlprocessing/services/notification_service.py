import os

import requests

API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "")


def notify_completion(video_id):
    if not API_BASE_URL or not SERVICE_SECRET:
        print(f"Notification skipped for {video_id}: API_BASE_URL or SERVICE_SECRET not set")
        return
    try:
        response = requests.post(
            f"{API_BASE_URL}/internal/send-email",
            json={"videoProcessingId": video_id},
            headers={"x-service-secret": SERVICE_SECRET},
            timeout=10
        )
        response.raise_for_status()
        print(f"Notification sent for {video_id}")
    except Exception as e:
        print(f"Notification failed for {video_id}: {e}")
