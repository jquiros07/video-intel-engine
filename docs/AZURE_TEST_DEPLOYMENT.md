# Azure Test Deployment

This document describes the recommended short-lived Azure deployment for `video-intel-engine` so the stack can be tested end to end and then deleted cleanly.

## Goal

Deploy the current system to Azure with the lowest reasonable complexity and cost for testing:

- `api` as a public HTTP service
- `mlprocessing` as a background queue worker
- Azure Blob Storage for uploaded videos
- Azure Queue Storage for processing messages
- Azure Database for PostgreSQL for application data

## Recommended Architecture

- One Azure resource group for everything
- One Azure Storage account
- One Blob container: `videos`
- One Queue: `video-processing-queue`
- One Azure Database for PostgreSQL Flexible Server
- One Azure Container Apps environment
- One Azure Container App for `api`
- One Azure Container App for `processor`

## Why This Design

- It matches the current codebase with minimal changes.
- The `api` service is an HTTP application.
- The `mlprocessing` service is currently a continuous queue worker, not a one-shot job.
- Blob and queue usage already exist in the code.
- A dedicated resource group makes cleanup easy.

## Resource Naming Example

Use any names you want, but keeping them predictable helps:

- Resource group: `rg-video-intel-test`
- Storage account: `stvideointeltest`
- Blob container: `videos`
- Queue: `video-processing-queue`
- PostgreSQL server: `psql-video-intel-test`
- Database: `video_intel`
- Container Apps environment: `cae-video-intel-test`
- API app: `video-intel-api`
- Processor app: `video-intel-processor`

## Azure Resources To Create

### 1. Resource Group

Create one temporary resource group and put all test resources inside it.

### 2. Storage Account

Create one storage account with:

- Performance: `Standard`
- Redundancy: `LRS`

Then create:

- Blob container `videos`
- Queue `video-processing-queue`

### 3. PostgreSQL Flexible Server

Create a PostgreSQL Flexible Server with:

- Smallest available `Burstable` tier
- No high availability
- Public access enabled
- Database name `video_intel`

For test deployments, this is the simplest setup.

### 4. Azure Container Apps Environment

Create a single Container Apps environment shared by both containers.

### 5. Container App: API

Deploy the `api` container with:

- External ingress enabled
- Target port `8080`
- Min replicas `0`
- Max replicas `1`

### 6. Container App: Processor

Deploy the `mlprocessing` container with:

- Ingress disabled
- Min replicas `1`
- Max replicas `1`

The processor needs one running replica because it continuously polls the queue.

## Images To Build

Build these images from the repo:

- `api/Dockerfile`
- `mlprocessing/Dockerfile`

The `mlprocessing` image installs CPU-only PyTorch and bakes in `yolov8n.pt` at build time, so it does not need a GPU and does not download model weights at startup. Expect a ~2-3 GB final image (down from ~4-5 GB with the default CUDA PyTorch build).

Push them to a container registry you control. For Azure deployments, **Azure Container Registry is recommended** — it integrates directly with Container Apps (no pull credentials to manage) and the Basic tier costs ~$5/month:

```bash
az acr create --resource-group rg-video-intel-test --name acrvideointeltest --sku Basic
az acr login --name acrvideointeltest

docker build -t acrvideointeltest.azurecr.io/video-intel-api:latest ./api
docker build -t acrvideointeltest.azurecr.io/video-intel-processor:latest ./mlprocessing

docker push acrvideointeltest.azurecr.io/video-intel-api:latest
docker push acrvideointeltest.azurecr.io/video-intel-processor:latest
```

When creating the Container Apps environment, grant it pull access to the registry:

```bash
az containerapp env create ... \
  --registry-server acrvideointeltest.azurecr.io
```

If the goal is a cheap short-lived test with no ACR cost, Docker Hub or GHCR are valid alternatives.

## Environment Variables

### API Container App

Set these values for the `api` app:

```env
PORT=8080
DATABASE_URL=postgresql://<admin-user>:<password>@<server>.postgres.database.azure.com:5432/video_intel?sslmode=require
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
AZURE_QUEUE_NAME=video-processing-queue
AZURE_BLOB_CONTAINER_NAME=videos
AZURE_BLOB_PUBLIC_BASE_URL=
JWT_SECRET_KEY=<strong-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRATION=60
VIDEO_UPLOAD_LIMIT=50mb
VIDEO_UPLOAD_PARSER_LIMIT=100mb
SERVICE_SECRET=<strong-random-secret>
SENDGRID_API_KEY=<sendgrid-api-key>
SENDGRID_FROM_EMAIL=<verified-sender-email>
SENDGRID_FROM_NAME=Video Intel Engine
```

### Processor Container App

Set these values for the `mlprocessing` app:

```env
DATABASE_URL=postgresql://<admin-user>:<password>@<server>.postgres.database.azure.com:5432/video_intel?sslmode=require
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
AZURE_QUEUE_NAME=video-processing-queue
AZURE_BLOB_CONTAINER_NAME=videos
API_BASE_URL=https://<api-container-app-fqdn>/api
SERVICE_SECRET=<same-strong-random-secret-as-api>
```

`API_BASE_URL` must point to the API Container App's fully qualified domain name (found in the Azure portal under the Container App's overview). `SERVICE_SECRET` must be the same value set on the API.

### Secret Guidance

Store these as secrets in Azure Container Apps instead of plain environment variables when possible:

- `DATABASE_URL`
- `AZURE_STORAGE_CONNECTION_STRING`
- `JWT_SECRET_KEY`
- `SERVICE_SECRET`
- `SENDGRID_API_KEY`

## Email Notifications

The processor automatically sends an email when a video finishes processing (both on success and failure) by calling the API's internal endpoint `POST /internal/send-email`. No manual trigger is needed.

For this to work, both `SERVICE_SECRET` and `SENDGRID_API_KEY` must be configured. If either is missing the notification is skipped silently — the job still completes normally.

### SendGrid Setup

1. Create a SendGrid account.
2. Create a SendGrid API key with mail send permission.
3. Verify a sender identity in SendGrid.
4. Set on the API container app:
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - optional `SENDGRID_FROM_NAME`

Important notes:

- `SENDGRID_FROM_EMAIL` must be a verified sender in your SendGrid account.
- The email is sent to the address stored on the `VideoProcessing` record at job creation time.
- The email includes the video URL, processing status, and result data.

## PostgreSQL Notes

### Firewall

For a quick test deployment:

- allow your local public IP
- allow Azure services to access the server

This is simpler than private networking for a temporary environment.

### TLS

Use `sslmode=require` in `DATABASE_URL`.

### Prisma Initialization

Before testing the API, initialize the database schema once from your machine:

```bash
cd api
npx prisma db push
```

Your local IP must be allowed by the PostgreSQL firewall for this to work.

## Deployment Order

1. Create the resource group.
2. Create the storage account.
3. Create the blob container and queue.
4. Create the PostgreSQL Flexible Server and `video_intel` database.
5. Configure PostgreSQL firewall rules.
6. Build and push the two container images.
7. Set `DATABASE_URL` locally and run `npx prisma db push` from `api`.
8. Create the Container Apps environment.
9. Deploy the `api` container app with all environment variables, including `SERVICE_SECRET`.
10. Deploy the `processor` container app with `API_BASE_URL` pointing to the API and the same `SERVICE_SECRET`.
11. If you want automatic email notifications, configure `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` on the API container app.
12. Test the API.

## Test Flow

After deployment:

1. Open the API Container App URL.
2. Request an access token:

```http
POST /api/request-access-token
```

3. Upload a video using multipart form data:

```http
POST /api/process-video
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form fields:

- `file`: the uploaded video file
- optional `videoUrl`: alternative source if not uploading a file

4. Verify:

- a row is created in `VideoProcessing`
- the video lands in Blob Storage
- a message lands in the queue
- the processor picks it up
- `VideoProcessing.status` changes from `PENDING` to `PROCESSING` and then `COMPLETED` or `FAILED`
- if SendGrid is configured, an email is automatically sent to the address on the job once the processor finishes (no manual trigger needed)

## Cleanup

When testing is done, delete the entire resource group.

This is the cleanest way to remove:

- Container Apps
- PostgreSQL
- Storage account
- queue and blob resources
- related Azure configuration

## Cost Controls

To keep this deployment cheap:

- use one temporary resource group
- choose the smallest PostgreSQL `Burstable` option (`Standard_B1ms`, ~$13/month)
- disable PostgreSQL HA
- use one storage account for both queue and blob
- keep API at `min replicas = 0`
- keep processor at `min replicas = 1` only because the current worker polls continuously

If testing spans more than one day, stop the PostgreSQL server when not in use.

Rough monthly cost at this scale: ~$20-30 (PostgreSQL dominates; Container Apps consumption is near-zero at low volume).

## Event-Driven Job Upgrade (recommended next step)

The current processor polls Azure Queue in an infinite loop, which requires `min replicas = 1` at all times. Converting it to an **ACA event-driven job** lets it scale to zero between videos and only run when a queue message arrives — the single biggest cost and simplicity win.

### What changes in the code

`mlprocessing/main.py` already supports single-job-and-exit mode via the `WORKER_MODE` environment variable. In docker-compose, `WORKER_MODE=loop` keeps it polling continuously for local dev. In Azure, omit that variable (default is `job`) and it will process one message and exit — exactly what ACA event-driven jobs expect.

### What changes in Azure

Instead of a Container App (long-running replica), create an **ACA Job** with a queue-based scale trigger:

```bash
az containerapp job create \
  --name video-intel-processor \
  --resource-group rg-video-intel-test \
  --environment cae-video-intel-test \
  --trigger-type Event \
  --replica-timeout 1800 \
  --replica-retry-limit 1 \
  --replica-completion-count 1 \
  --parallelism 1 \
  --image acrvideointeltest.azurecr.io/video-intel-processor:latest \
  --scale-rule-name queue-trigger \
  --scale-rule-type azure-queue \
  --scale-rule-metadata "accountName=stvideointeltest" "queueName=video-processing-queue" "queueLength=1" \
  --scale-rule-auth "connection=azure-storage-connection-string" \
  --env-vars \
      DATABASE_URL=secretref:database-url \
      AZURE_STORAGE_CONNECTION_STRING=secretref:azure-storage-connection-string \
      AZURE_QUEUE_NAME=video-processing-queue \
      AZURE_BLOB_CONTAINER_NAME=videos \
      API_BASE_URL=https://<api-container-app-fqdn>/api \
      SERVICE_SECRET=secretref:service-secret
```

With this setup:
- Zero cost when queue is empty
- One container instance per video, auto-cleaned up after completion
- `replica-timeout 1800` gives 30 minutes max per job (adjust to your longest expected video)

## Codebase Mapping

Relevant files in this repo:

- API HTTP startup: [api/src/index.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/index.ts:1)
- API routes: [api/src/routes/routes.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/routes/routes.ts:1)
- Video upload middleware: [api/src/middlewares/parse-video-upload.middleware.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/middlewares/parse-video-upload.middleware.ts:1)
- API video processing controller: [api/src/controllers/video-process.controller.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/controllers/video-process.controller.ts:1)
- API process results email helper: [api/src/helpers/process-results-email.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/helpers/process-results-email.ts:1)
- API blob storage helper: [api/src/helpers/upload-storage.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/helpers/upload-storage.ts:1)
- API upload helper: [api/src/helpers/video-upload.ts](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/api/src/helpers/video-upload.ts:1)
- Processor main loop: [mlprocessing/main.py](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/mlprocessing/main.py:1)
- Processor queue client: [mlprocessing/job_queue/azure_queue_client.py](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/mlprocessing/job_queue/azure_queue_client.py:1)
- Processor video service: [mlprocessing/services/video_service.py](/abs/path/c:/Users/Macho/Personal%20Projects/video-intel-engine/mlprocessing/services/video_service.py:1)
