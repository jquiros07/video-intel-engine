import os
import tempfile
import urllib.parse
import urllib.request

from azure.storage.blob import BlobServiceClient
from loguru import logger

from analyzers.threat.threat_analyzer import analyze
from db.video_processing import (
    mark_failed,
    save_result,
    update_status,
)
from enums import VideoProcessingStatus
from services.notification_service import notify_completion

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_BLOB_CONTAINER_NAME = os.getenv("AZURE_BLOB_CONTAINER_NAME", "videos")

if not AZURE_STORAGE_CONNECTION_STRING:
    raise RuntimeError("Missing environment variable: AZURE_STORAGE_CONNECTION_STRING")


def process_video_job(data):
    video_id = data.get("video_processing_id") or data.get("id")
    blob_name = data.get("blob_name") or data.get("blobName")
    video_source = data.get("video_url") or data.get("videoUrl")

    if not video_id or (not blob_name and not video_source):
        raise KeyError("Job payload must include a video ID and video source")

    local_video_path = None
    try:
        logger.info("Processing started | video_id={}", video_id)
        update_status(video_id, VideoProcessingStatus.PROCESSING)

        logger.info("Resolving video source | video_id={}", video_id)
        local_video_path, video_path = resolve_video_source(blob_name, video_source)

        logger.info("Running threat analysis | video_id={}", video_id)
        result = analyze(video_path)

        logger.info(
            "Analysis complete | video_id={} events={} risk_score={}",
            video_id,
            result["summary"]["total_events"],
            result["summary"]["risk_score"],
        )

        save_result(video_id, {"threat": result})
        logger.info("Result saved | video_id={}", video_id)
        notify_completion(video_id)
    except Exception as error:
        logger.exception("Processing failed | video_id={}", video_id)
        mark_failed(video_id, error)
        notify_completion(video_id)
        raise
    finally:
        cleanup_temporary_file(local_video_path)


def resolve_video_source(blob_name, video_source):
    if blob_name:
        return download_blob(blob_name)

    if is_remote_url(video_source):
        return download_video(video_source)

    return None, video_source


def download_blob(blob_name):
    _, extension = os.path.splitext(blob_name)
    container_client = BlobServiceClient.from_connection_string(
        AZURE_STORAGE_CONNECTION_STRING
    ).get_container_client(AZURE_BLOB_CONTAINER_NAME)
    blob_client = container_client.get_blob_client(blob_name)

    with tempfile.NamedTemporaryFile(delete=False, suffix=extension or ".mp4") as tmp_file:
        tmp_file.write(blob_client.download_blob().readall())
        return tmp_file.name, tmp_file.name


def is_remote_url(video_source):
    parsed = urllib.parse.urlparse(video_source)
    return parsed.scheme in ("http", "https")


def download_video(video_url):
    parsed_url = urllib.parse.urlparse(video_url)
    _, extension = os.path.splitext(parsed_url.path)

    with urllib.request.urlopen(video_url) as response:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension or ".mp4") as tmp_file:
            tmp_file.write(response.read())
            return tmp_file.name, tmp_file.name


def cleanup_temporary_file(file_path):
    if not file_path:
        return

    try:
        os.remove(file_path)
    except FileNotFoundError:
        pass
