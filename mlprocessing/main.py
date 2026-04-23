import os

from job_queue.azure_queue_client import complete_job, get_job
from services.video_service import process_video_job

loop = os.getenv("WORKER_MODE", "job") == "loop"

while True:
    message = None
    try:
        job, message = get_job()
        if job:
            process_video_job(job.get("data", job))
            print("Job completed")
        elif not loop:
            print("No job in queue, exiting.")
            break
    except Exception as e:
        print(f"Worker error: {e}")
        if not loop:
            raise
    finally:
        complete_job(message)
    if not loop:
        break
