import os
from pathlib import Path

from ultralytics import YOLO

os.environ.setdefault("YOLO_CONFIG_DIR", str(Path(__file__).resolve().parents[2] / ".yolo"))

POSE_MODEL_PATH = os.getenv("YOLO_POSE_MODEL", "yolov8s-pose.pt")
_pose_model = None

# COCO keypoint indices
_L_SHOULDER, _R_SHOULDER = 5, 6
_L_WRIST, _R_WRIST = 9, 10
_L_HIP, _R_HIP = 11, 12

_MIN_KP_CONF = 0.4
_MIN_PERSON_CONF = 0.4


def _get_model():
    global _pose_model
    if _pose_model is None:
        _pose_model = YOLO(POSE_MODEL_PATH)
    return _pose_model


def _kp(keypoints, idx):
    """Return (x, y) for a keypoint if its confidence meets the threshold, else None."""
    x, y, conf = float(keypoints[idx][0]), float(keypoints[idx][1]), float(keypoints[idx][2])
    return (x, y) if conf >= _MIN_KP_CONF else None


def _is_aggressive(keypoints):
    """
    Detect aggressive body posture from COCO keypoints.
    Triggers on raised arms (wrists above shoulders) or fallen person (hips above shoulders in frame).
    """
    l_shoulder = _kp(keypoints, _L_SHOULDER)
    r_shoulder = _kp(keypoints, _R_SHOULDER)
    l_wrist = _kp(keypoints, _L_WRIST)
    r_wrist = _kp(keypoints, _R_WRIST)
    l_hip = _kp(keypoints, _L_HIP)
    r_hip = _kp(keypoints, _R_HIP)

    # Raised arm: wrist y < shoulder y (smaller y = higher in frame)
    if l_wrist and l_shoulder and l_wrist[1] < l_shoulder[1]:
        return True
    if r_wrist and r_shoulder and r_wrist[1] < r_shoulder[1]:
        return True

    # Fallen person: average hip y < average shoulder y
    shoulder_ys = [p[1] for p in [l_shoulder, r_shoulder] if p]
    hip_ys = [p[1] for p in [l_hip, r_hip] if p]
    if shoulder_ys and hip_ys:
        if sum(hip_ys) / len(hip_ys) < sum(shoulder_ys) / len(shoulder_ys):
            return True

    return False


def analyze_pose(frame):
    """
    Run pose estimation on a frame.
    Returns list of {bbox, is_aggressive, confidence} for each detected person.
    """
    current_model = _get_model()
    results = current_model(frame, device="cpu", verbose=False)

    poses = []
    for r in results:
        if r.keypoints is None or r.boxes is None:
            continue
        for i, box in enumerate(r.boxes):
            conf = float(box.conf)
            if conf < _MIN_PERSON_CONF:
                continue
            kps = r.keypoints.data[i].cpu().numpy()
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            poses.append({
                "bbox": [x1, y1, x2, y2],
                "is_aggressive": _is_aggressive(kps),
                "confidence": conf,
            })

    return poses
