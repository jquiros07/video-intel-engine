import os
from pathlib import Path

os.environ.setdefault("YOLO_CONFIG_DIR", str(Path(__file__).resolve().parents[2] / ".yolo"))
from ultralytics import YOLO

CONF_THRESHOLD = 0.5
MODEL_PATH = os.getenv("YOLO_MODEL", "yolov5s.pt")
model = None


def get_model():
    global model

    if model is None:
        model = YOLO(MODEL_PATH)

    return model


def detect(frame):
    current_model = get_model()
    results = current_model(frame)

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
