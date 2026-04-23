import math
from pathlib import Path

import yaml

with open(Path(__file__).parent / "rules_config.yaml") as f:
    _cfg = yaml.safe_load(f)

_close = _cfg["close_confrontation"]
_crowd = _cfg["crowd_tension"]
_motion = _cfg["aggressive_motion"]
_threat = _cfg["possible_threat"]
_violence = _cfg["possible_violence"]


def center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def evaluate(detections, motion_score, timestamp):
    events = []

    persons = [d for d in detections if d["label"] == "person"]
    weapons = [d for d in detections if d["label"] in _cfg["analyzer"]["weapon_labels"]]

    if weapons and persons:
        events.append({
            "event": "possible_threat",
            "timestamp": timestamp,
            "confidence": _threat["confidence"]
        })

    close_pairs = 0

    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            p1 = center(persons[i]["bbox"])
            p2 = center(persons[j]["bbox"])

            if distance(p1, p2) < _close["distance_threshold"]:
                close_pairs += 1

                events.append({
                    "event": "close_confrontation",
                    "timestamp": timestamp,
                    "confidence": _close["confidence"]
                })

    if len(persons) >= _crowd["min_persons"]:
        events.append({
            "event": "crowd_tension",
            "timestamp": timestamp,
            "confidence": _crowd["confidence"]
        })

    if motion_score > _motion["motion_score_threshold"]:
        events.append({
            "event": "aggressive_motion",
            "timestamp": timestamp,
            "confidence": _motion["confidence"],
            "motion_score": motion_score
        })

    if motion_score > _violence["motion_score_threshold"] and close_pairs >= _violence["min_close_pairs"]:
        events.append({
            "event": "possible_violence",
            "timestamp": timestamp,
            "confidence": _violence["confidence"]
        })

    return events
