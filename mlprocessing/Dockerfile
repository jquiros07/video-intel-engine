FROM python:3.11-slim

WORKDIR /app

# System libs required by OpenCV (pulled in transitively by ultralytics)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch before ultralytics to avoid pulling the ~2 GB CUDA build
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake models in at build time — avoids runtime downloads in Azure
ENV YOLO_CONFIG_DIR=/app/.yolo
ENV YOLO_MODEL=yolov8s.pt
ENV YOLO_POSE_MODEL=yolov8s-pose.pt
RUN python -c "from ultralytics import YOLO; YOLO('yolov8s.pt'); YOLO('yolov8s-pose.pt')"

COPY . .

CMD ["python", "main.py"]
