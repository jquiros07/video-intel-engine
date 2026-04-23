import os

from loguru import logger
from job_queue.azure_queue_client import complete_job, get_job
from services.video_service import process_video_job

os.makedirs("/app/logs", exist_ok=True)
logger.add("/app/logs/processor.log", rotation="10 MB", retention="7 days")

loop = os.getenv("WORKER_MODE", "job") == "loop"

logger.info("Worker started (mode={})", "loop" if loop else "job")

while True:
    message = None
    try:
        job, message = get_job()
        if job:
            logger.info("Job received, processing...")
            process_video_job(job.get("data", job))
            logger.info("Job completed")
        elif not loop:
            logger.info("No job in queue, exiting")
            break
    except Exception as e:
        logger.exception("Worker error: {}", e)
        if not loop:
            raise
    finally:
        complete_job(message)
    if not loop:
        break
