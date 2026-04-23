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
_cooldown = _cfg["cooldown"]["seconds"]


def center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def _can_fire(event_type, timestamp, last_fired):
    last = last_fired.get(event_type)
    return last is None or (timestamp - last) >= _cooldown


def _fire(event_type, event_data, timestamp, last_fired, events):
    last_fired[event_type] = timestamp
    events.append(event_data)


def evaluate(detections, motion_score, timestamp, last_fired):
    events = []

    persons = [d for d in detections if d["label"] == "person"]
    weapons = [d for d in detections if d["label"] in _cfg["analyzer"]["weapon_labels"]]

    if weapons and persons and _can_fire("possible_threat", timestamp, last_fired):
        _fire("possible_threat", {
            "event": "possible_threat",
            "timestamp": timestamp,
            "confidence": _threat["confidence"]
        }, timestamp, last_fired, events)

    close_pairs = 0

    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            p1 = center(persons[i]["bbox"])
            p2 = center(persons[j]["bbox"])

            if distance(p1, p2) < _close["distance_threshold"]:
                close_pairs += 1

                if _can_fire("close_confrontation", timestamp, last_fired):
                    _fire("close_confrontation", {
                        "event": "close_confrontation",
                        "timestamp": timestamp,
                        "confidence": _close["confidence"]
                    }, timestamp, last_fired, events)

    if len(persons) >= _crowd["min_persons"] and _can_fire("crowd_tension", timestamp, last_fired):
        _fire("crowd_tension", {
            "event": "crowd_tension",
            "timestamp": timestamp,
            "confidence": _crowd["confidence"]
        }, timestamp, last_fired, events)

    if motion_score > _motion["motion_score_threshold"] and _can_fire("aggressive_motion", timestamp, last_fired):
        _fire("aggressive_motion", {
            "event": "aggressive_motion",
            "timestamp": timestamp,
            "confidence": _motion["confidence"],
            "motion_score": motion_score
        }, timestamp, last_fired, events)

    if (motion_score > _violence["motion_score_threshold"]
            and close_pairs >= _violence["min_close_pairs"]
            and _can_fire("possible_violence", timestamp, last_fired)):
        _fire("possible_violence", {
            "event": "possible_violence",
            "timestamp": timestamp,
            "confidence": _violence["confidence"]
        }, timestamp, last_fired, events)

    return events
