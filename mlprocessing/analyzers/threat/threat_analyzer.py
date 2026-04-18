import cv2

from analyzers.threat.detector import detect
from analyzers.threat.motion import compute_motion
from analyzers.threat.rules import evaluate

FRAME_INTERVAL = 2  # seconds


def analyze(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        raise ValueError(f"Unable to open video source: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, int(fps * FRAME_INTERVAL)) if fps and fps > 0 else 1
    frame_id = 0

    events = []
    prev_gray = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_id % frame_interval == 0:
            timestamp = round(frame_id / fps, 2) if fps and fps > 0 else float(frame_id)

            detections = detect(frame)
            prev_gray, motion_score = compute_motion(prev_gray, frame)
            frame_events = evaluate(detections, motion_score, timestamp)

            events.extend(frame_events)

        frame_id += 1

    cap.release()

    return {
        "events": events,
        "summary": build_summary(events)
    }


def build_summary(events):
    risk_score = min(len(events) * 0.1, 1.0)

    return {
        "total_events": len(events),
        "risk_score": round(risk_score, 2)
    }
