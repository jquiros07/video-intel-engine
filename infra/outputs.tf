output "resource_group_name" {
  description = "Delete this to tear down the entire deployment"
  value       = azurerm_resource_group.main.name
}

output "acr_login_server" {
  description = "Registry hostname — use this as the image prefix when pushing"
  value       = azurerm_container_registry.main.login_server
}

output "acr_name" {
  description = "Registry name — use with `az acr login --name`"
  value       = azurerm_container_registry.main.name
}

output "api_url" {
  description = "Public URL of the API"
  value       = "https://ca-${var.prefix}-api.${azurerm_container_app_environment.main.default_domain}"
}

output "postgresql_fqdn" {
  description = "PostgreSQL server hostname — needed for DATABASE_URL"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "storage_account_name" {
  value = azurerm_storage_account.main.name
}

output "docker_commands" {
  description = "Commands to build and push images after `terraform apply`"
  value       = <<-EOT
    az acr login --name ${azurerm_container_registry.main.name}
    docker build -t ${azurerm_container_registry.main.login_server}/video-intel-api:${var.image_tag} ./api
    docker build -t ${azurerm_container_registry.main.login_server}/video-intel-processor:${var.image_tag} ./mlprocessing
    docker push ${azurerm_container_registry.main.login_server}/video-intel-api:${var.image_tag}
    docker push ${azurerm_container_registry.main.login_server}/video-intel-processor:${var.image_tag}
  EOT
}

output "prisma_migrate_command" {
  description = "Run this once after `terraform apply` to initialise the database schema"
  sensitive   = true
  value       = "cd api && DATABASE_URL=\"${local.database_url}\" npx prisma db push"
}
