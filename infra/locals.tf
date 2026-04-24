locals {
  database_url = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/video_intel?sslmode=require"
}
