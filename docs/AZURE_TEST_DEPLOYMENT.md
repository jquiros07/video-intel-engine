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

Push them to a container registry you control, such as:

- Docker Hub
- GitHub Container Registry
- Azure Container Registry

If the goal is a cheap short-lived test, Docker Hub or GHCR can avoid adding Azure Container Registry cost.

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
```

### Secret Guidance

Store these as secrets in Azure Container Apps instead of plain environment variables when possible:

- `DATABASE_URL`
- `AZURE_STORAGE_CONNECTION_STRING`
- `JWT_SECRET_KEY`
- `SENDGRID_API_KEY`

## SendGrid Setup

If you want the API to send processing result emails, configure Twilio SendGrid before testing the `/api/send-email` endpoint.

Minimum setup:

1. Create a SendGrid account.
2. Create a SendGrid API key with mail send permission.
3. Verify a sender identity in SendGrid.
4. Set these API container app settings:
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - optional `SENDGRID_FROM_NAME`

Important notes:

- `SENDGRID_FROM_EMAIL` must be a verified sender in your SendGrid account.
- The API sends the results email to the `email` associated with the authenticated access token.
- The email includes the `videoUrl`, the processing status, and the serialized `resultData`.

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
9. Deploy the `api` container app.
10. Deploy the `processor` container app.
11. Configure environment variables and secrets in both apps.
12. If you want email delivery, configure SendGrid settings in the API container app.
13. Test the API.

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

5. If SendGrid is configured, send the process results email:

```http
POST /api/send-email
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "videoProcessingId": "<video-processing-id>"
}
```

Expected behavior:

- the API looks up the `VideoProcessing` row for the authenticated email
- the request fails if the record does not belong to that email
- the request fails with `409` if `resultData` is not ready yet
- the email includes the video URL and process results when available

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
- choose the smallest PostgreSQL `Burstable` option
- disable PostgreSQL HA
- use one storage account for both queue and blob
- keep API at `min replicas = 0`
- keep processor at `min replicas = 1` only because the current worker is always-on

If testing spans more than one day, stop the PostgreSQL server when you are not using it.

## Future Improvement

The first improvement to reduce idle cost would be changing `mlprocessing` from a continuous worker container into an Azure Container Apps event-driven job triggered by Azure Queue.

That would let the processor scale closer to zero between jobs.

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
