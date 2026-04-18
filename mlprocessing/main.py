import time

from job_queue.redis_client import get_job
from services.video_service import process_video_job

print("Worker started...")

while True:
    try:
        job = get_job()
        if not job:
            continue

        data = job.get("data", job)
        process_video_job(data)

        print("Job completed")
    except Exception as e:
        print(f"Worker error: {e}")
        time.sleep(2)
