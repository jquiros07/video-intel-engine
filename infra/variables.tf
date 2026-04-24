variable "prefix" {
  description = "Short name prefix for all resources (e.g. 'video-intel')"
  type        = string
  default     = "video-intel"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "db_admin_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "videointeladmin"
}

variable "db_admin_password" {
  description = "PostgreSQL admin password — must include uppercase, lowercase, digit, and special character"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT signing secret for the API"
  type        = string
  sensitive   = true
}

variable "jwt_expiration" {
  description = "JWT expiration in minutes"
  type        = number
  default     = 60
}

variable "service_secret" {
  description = "Shared secret for internal API↔processor calls (must match on both sides)"
  type        = string
  sensitive   = true
}

variable "mailtrap_api_token" {
  description = "Mailtrap API token — email notifications are skipped if empty"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mailtrap_from_email" {
  description = "Sender email address for Mailtrap"
  type        = string
  default     = ""
}

variable "mailtrap_from_name" {
  description = "Sender display name for email notifications"
  type        = string
  default     = "Video Intel Engine"
}

variable "my_ip_address" {
  description = "Your local IP to allow Prisma migrations to reach PostgreSQL (optional)"
  type        = string
  default     = ""
}
