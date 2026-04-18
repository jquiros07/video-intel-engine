import json

import redis

from config import QUEUE_NAME, REDIS_URL

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def get_job(timeout=5):
    result = r.brpop(QUEUE_NAME, timeout=timeout)
    if not result:
        return None

    _, job = result
    return json.loads(job)
