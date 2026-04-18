import os
import json
import redis
import time

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
r = redis.Redis.from_url(REDIS_URL)

QUEUE_NAME = 'video_processing_queue'

def process_video(job_data):
    print(f"Starting to process video: {job_data.get('videoUrl')}", flush=True)
    # Simulate processing time
    time.sleep(5)
    print(f"Finished processing video: {job_data.get('videoUrl')}", flush=True)

def main():
    print(f"Python processor started. Listening on queue: {QUEUE_NAME}", flush=True)
    while True:
        try:
            # BRPOP blocks until an item is available in the queue
            # Format returned: (b'queue_name', b'data')
            result = r.brpop(QUEUE_NAME)
            if result:
                _, msg = result
                job_data = json.loads(msg.decode('utf-8'))
                process_video(job_data)
        except Exception as e:
            print(f"Error processing job: {e}", flush=True)
            time.sleep(1)

if __name__ == "__main__":
    main()
