import json
import os

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import QueueClient

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_QUEUE_NAME = os.getenv("AZURE_QUEUE_NAME", "video-processing-queue")

if not AZURE_STORAGE_CONNECTION_STRING:
    raise RuntimeError("Missing environment variable: AZURE_STORAGE_CONNECTION_STRING")

queue_client = QueueClient.from_connection_string(
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_QUEUE_NAME
)
try:
    queue_client.create_queue()
except ResourceExistsError:
    pass


def get_job(visibility_timeout=300):
    messages = queue_client.receive_messages(messages_per_page=1, visibility_timeout=visibility_timeout)

    for page in messages.by_page():
        for message in page:
            return json.loads(message.content), message

    return None, None


def complete_job(message):
    if not message:
        return

    queue_client.delete_message(message.id, message.pop_receipt)
