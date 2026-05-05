# Terraform Deployment

> **Tested on:** Windows 11 · Terraform v1.14.9 · PowerShell 5.1
> All commands in this guide use PowerShell syntax. The `-target` flags use a space (not `=`) which is required on Windows — `=` causes PowerShell to misparse the resource address.

## Prerequisites

Make sure these are installed:

```powershell
az version
terraform -version
docker version
```

---

## Steps

### 1. Log in to Azure

```powershell
az login
```

### 2. Register required Azure namespaces

Only needed once per subscription:

```powershell
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

### 3. Create your tfvars file

```powershell
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Fill in `terraform.tfvars`:
- `db_admin_password` — must include uppercase, lowercase, digit, and special char
- `jwt_secret_key` — any long random string
- `service_secret` — any long random string
- `my_ip_address` — your public IP (Google "what is my ip")
- `location` — if `eastus` is restricted on your subscription, try `eastus2` or `westus2`

### 4. Provision base infrastructure (ACR, storage, database)

```powershell
terraform init
terraform apply -target azurerm_resource_group.main -target azurerm_log_analytics_workspace.main -target azurerm_storage_account.main -target azurerm_storage_container.videos -target azurerm_storage_queue.main -target azurerm_postgresql_flexible_server.main -target azurerm_postgresql_flexible_server_database.main -target azurerm_postgresql_flexible_server_firewall_rule.allow_azure_services -target azurerm_container_registry.main
```

Type `yes` when prompted. Takes ~5–10 minutes (PostgreSQL is the slow part).

### 5. Build and push Docker images

From `infra/`, get the generated docker commands:

```powershell
terraform output -raw docker_commands
```

Then **go to the repo root** and run the commands from the output. They log in to ACR, build both images, and push them.

```powershell
cd ..
```

### 6. Deploy Container Apps

From `infra/`:

```powershell
terraform apply
```

This creates the API Container App and the processor ACA Job now that the images exist in the registry.

### 7. Initialize the database schema

From `infra/`, get the DATABASE_URL:

```powershell
terraform output -raw prisma_migrate_command
```

Copy the URL value from the output. Then open a new terminal at the **repo root** and run these three commands in PowerShell:

```powershell
cd api
$env:DATABASE_URL="<paste your DATABASE_URL here>"
npx prisma db push
```

### 8. Get the API URL

```powershell
terraform output api_url
```

Use this stable URL for all requests. Do not use revision-specific URLs (e.g. `--agepphp`) — those break when new revisions are deployed.

### 9. Verify

Hit `<api_url>/api/request-access-token` to confirm the API is up.
Then upload a video and check **Container Apps Jobs → Execution history** in the Azure portal.

---

## Redeploying after code changes

### API changes

From the **repo root**:

```powershell
az acr login --name <acr-name>
docker build -t <acr-name>.azurecr.io/video-intel-api:latest ./api
docker push <acr-name>.azurecr.io/video-intel-api:latest
az containerapp update --name ca-video-intel-api --resource-group rg-video-intel --image <acr-name>.azurecr.io/video-intel-api:latest --revision-suffix <new-suffix>
```

Get the ACR name with `terraform output acr_name`.

### Processor changes

From the **repo root**:

```powershell
az acr login --name <acr-name>
docker build -t <acr-name>.azurecr.io/video-intel-processor:latest ./mlprocessing
docker push <acr-name>.azurecr.io/video-intel-processor:latest
```

No update command needed — the ACA Job pulls the latest image on every execution.

---

## Teardown

```powershell
az group delete --name rg-video-intel --yes
```

Deletes every resource in one shot.
