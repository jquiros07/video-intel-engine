resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.prefix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# ── API ──────────────────────────────────────────────────────────────────────

resource "azurerm_container_app" "api" {
  name                         = "ca-${var.prefix}-api"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }
  secret {
    name  = "azure-storage-connection-string"
    value = azurerm_storage_account.main.primary_connection_string
  }
  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "jwt-secret-key"
    value = var.jwt_secret_key
  }
  secret {
    name  = "service-secret"
    value = var.service_secret
  }
  secret {
    name  = "mailtrap-api-token"
    value = var.mailtrap_api_token
  }

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  template {
    min_replicas = 0
    max_replicas = 3

    container {
      name   = "api"
      image  = "${azurerm_container_registry.main.login_server}/video-intel-api:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "azure-storage-connection-string"
      }
      env {
        name  = "AZURE_QUEUE_NAME"
        value = azurerm_storage_queue.main.name
      }
      env {
        name  = "AZURE_BLOB_CONTAINER_NAME"
        value = azurerm_storage_container.videos.name
      }
      env {
        name        = "JWT_SECRET_KEY"
        secret_name = "jwt-secret-key"
      }
      env {
        name  = "JWT_ALGORITHM"
        value = "HS256"
      }
      env {
        name  = "JWT_EXPIRATION"
        value = tostring(var.jwt_expiration)
      }
      env {
        name  = "VIDEO_UPLOAD_LIMIT"
        value = "50mb"
      }
      env {
        name  = "VIDEO_UPLOAD_PARSER_LIMIT"
        value = "100mb"
      }
      env {
        name        = "SERVICE_SECRET"
        secret_name = "service-secret"
      }
      env {
        name        = "MAILTRAP_API_TOKEN"
        secret_name = "mailtrap-api-token"
      }
      env {
        name  = "MAILTRAP_FROM_EMAIL"
        value = var.mailtrap_from_email
      }
      env {
        name  = "MAILTRAP_FROM_NAME"
        value = var.mailtrap_from_name
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# ── Processor (ACA Event-Driven Job) ─────────────────────────────────────────
#
# Scales to zero when the queue is empty. Spins up one container per message,
# processes it, then exits. WORKER_MODE defaults to "job" in the processor
# code so no extra env var is needed.

resource "azurerm_container_app_job" "processor" {
  name                         = "job-${var.prefix}-processor"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  container_app_environment_id = azurerm_container_app_environment.main.id

  replica_timeout_in_seconds = 1800
  replica_retry_limit        = 1

  event_trigger_config {
    parallelism              = 1
    replica_completion_count = 1

    scale {
      min_executions = 0
      max_executions = 10

      rules {
        name             = "queue-trigger"
        custom_rule_type = "azure-queue"

        metadata = {
          accountName = azurerm_storage_account.main.name
          queueName   = azurerm_storage_queue.main.name
          queueLength = "1"
          cloud       = "AzurePublicCloud"
        }

        authentication {
          secret_name       = "azure-storage-connection-string"
          trigger_parameter = "connection"
        }
      }
    }
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }
  secret {
    name  = "azure-storage-connection-string"
    value = azurerm_storage_account.main.primary_connection_string
  }
  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "service-secret"
    value = var.service_secret
  }

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  template {
    container {
      name   = "processor"
      image  = "${azurerm_container_registry.main.login_server}/video-intel-processor:${var.image_tag}"
      # YOLOv8n CPU inference — increase cpu/memory for larger models or longer videos
      cpu    = 1.0
      memory = "2Gi"

      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "azure-storage-connection-string"
      }
      env {
        name  = "AZURE_QUEUE_NAME"
        value = azurerm_storage_queue.main.name
      }
      env {
        name  = "AZURE_BLOB_CONTAINER_NAME"
        value = azurerm_storage_container.videos.name
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name  = "API_BASE_URL"
        value = "https://ca-${var.prefix}-api.${azurerm_container_app_environment.main.default_domain}/api"
      }
      env {
        name        = "SERVICE_SECRET"
        secret_name = "service-secret"
      }
    }
  }
}
