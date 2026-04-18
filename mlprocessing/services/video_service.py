from analyzers.threat.threat_analyzer import analyze
from db.video_processing import (
    mark_failed,
    save_result,
    update_status,
)


def process_video_job(data):
    video_id = data.get("video_processing_id") or data.get("id")
    video_url = data.get("video_url") or data.get("videoUrl")

    if not video_id or not video_url:
        raise KeyError("Job payload must include a video ID and video URL")

    try:
        update_status(video_id, "PROCESSING")

        result = analyze(video_url)

        save_result(video_id, {
            "threat": result
        })
    except Exception as error:
        mark_failed(video_id, error)
        raise
