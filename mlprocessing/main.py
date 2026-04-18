import time

from job_queue.azure_queue_client import complete_job, get_job
from services.video_service import process_video_job

print("Worker started...")

while True:
    message = None
    try:
        job, message = get_job()
        if not job:
            continue

        data = job.get("data", job)
        process_video_job(data)

        print("Job completed")
    except Exception as e:
        print(f"Worker error: {e}")
        time.sleep(2)
    finally:
        complete_job(message)
