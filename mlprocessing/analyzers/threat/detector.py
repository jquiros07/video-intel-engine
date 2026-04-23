import os
from pathlib import Path

import yaml
from ultralytics import YOLO

os.environ.setdefault("YOLO_CONFIG_DIR", str(Path(__file__).resolve().parents[2] / ".yolo"))

with open(Path(__file__).parent / "rules_config.yaml") as f:
    _cfg = yaml.safe_load(f)

CONF_THRESHOLD = _cfg["analyzer"]["conf_threshold"]
MODEL_PATH = os.getenv("YOLO_MODEL", "yolov8n.pt")
model = None


def get_model():
    global model

    if model is None:
        model = YOLO(MODEL_PATH)

    return model


def detect(frame):
    current_model = get_model()
    results = current_model(frame, device="cpu", verbose=False)

    detections = []

    for r in results:
        for box in r.boxes:
            cls = int(box.cls)
            label = current_model.names[cls]
            conf = float(box.conf)

            if conf < CONF_THRESHOLD:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            detections.append({
                "label": label,
                "confidence": conf,
                "bbox": [x1, y1, x2, y2]
            })

    return detections
