resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${var.prefix}-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "15"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  sku_name               = "B_Standard_B1ms"
  storage_mb             = 32768
  backup_retention_days  = 7
  zone                   = "1"
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "video_intel"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Allows Azure services (Container Apps) to reach the database
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Your local IP — needed to run `prisma db push` from your machine
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_local_ip" {
  count            = var.my_ip_address != "" ? 1 : 0
  name             = "AllowLocalIP"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.my_ip_address
  end_ip_address   = var.my_ip_address
}
