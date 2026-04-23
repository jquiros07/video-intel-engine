from pathlib import Path

import cv2
import yaml
from loguru import logger

from analyzers.threat.detector import detect
from analyzers.threat.motion import compute_motion
from analyzers.threat.rules import evaluate

with open(Path(__file__).parent / "rules_config.yaml") as f:
    _cfg = yaml.safe_load(f)

FRAME_INTERVAL = _cfg["analyzer"]["frame_interval"]
_risk_cfg = _cfg["risk_score"]


def analyze(video_path):
    logger.info("Opening video | path={}", video_path)
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
    summary = build_summary(events)
    logger.info("Video analysis done | frames_processed={} events={} risk_score={}", frame_id, summary["total_events"], summary["risk_score"])

    return {
        "events": events,
        "summary": summary
    }


def compute_risk_score(events):
    unique_types = set(e["event"] for e in events)
    score = min(len(unique_types) * _risk_cfg["score_per_unique_event"], 1.0)

    if score >= _risk_cfg["high_threshold"]:
        level = "high"
    elif score >= _risk_cfg["medium_threshold"]:
        level = "medium"
    else:
        level = "low"

    return round(score, 2), level


def build_summary(events):
    risk_score, risk_level = compute_risk_score(events)

    breakdown = {}
    for e in events:
        breakdown[e["event"]] = breakdown.get(e["event"], 0) + 1

    return {
        "total_events": len(events),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "breakdown": breakdown
    }
