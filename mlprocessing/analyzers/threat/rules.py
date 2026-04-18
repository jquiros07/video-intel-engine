import math

def center(box):
    x1, y1, x2, y2 = box
    return ((x1+x2)//2, (y1+y2)//2)

def distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)


def evaluate(detections, motion_score, timestamp):
    events = []

    persons = [d for d in detections if d["label"] == "person"]
    weapons = [d for d in detections if d["label"] in ["knife", "scissors"]]

    # 🔴 Weapon + people → threat
    if weapons and persons:
        events.append({
            "event": "possible_threat",
            "timestamp": timestamp,
            "confidence": 0.7
        })

    # 🔴 Close confrontation
    close_pairs = 0

    for i in range(len(persons)):
        for j in range(i+1, len(persons)):
            p1 = center(persons[i]["bbox"])
            p2 = center(persons[j]["bbox"])

            if distance(p1, p2) < 100:
                close_pairs += 1

                events.append({
                    "event": "close_confrontation",
                    "timestamp": timestamp,
                    "confidence": 0.6
                })

    # 🔴 Crowd
    if len(persons) >= 4:
        events.append({
            "event": "crowd_tension",
            "timestamp": timestamp,
            "confidence": 0.6
        })

    # 🔴 Aggressive motion
    if motion_score > 25:
        events.append({
            "event": "aggressive_motion",
            "timestamp": timestamp,
            "confidence": 0.65,
            "motion_score": motion_score
        })

    # 🔴 Possible violence (combined rule)
    if motion_score > 25 and close_pairs >= 1:
        events.append({
            "event": "possible_violence",
            "timestamp": timestamp,
            "confidence": 0.75
        })

    return events