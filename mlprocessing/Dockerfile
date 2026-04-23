FROM python:3.10-slim

WORKDIR /app

# Install CPU-only PyTorch before ultralytics to avoid pulling the ~2 GB CUDA build
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the model in at build time — avoids runtime downloads in Azure
ENV YOLO_CONFIG_DIR=/app/.yolo
ENV YOLO_MODEL=yolov8n.pt
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY . .

CMD ["python", "main.py"]
