# Cognito Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "vkp"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "callback_urls" {
  description = "List of callback URLs for OAuth"
  type        = list(string)
  default     = ["https://vkp-consulting.fr/callback", "https://vkp-consulting.fr"]
}

variable "logout_urls" {
  description = "List of logout URLs"
  type        = list(string)
  default     = ["https://vkp-consulting.fr/logout", "https://vkp-consulting.fr"]
}

variable "domain_prefix" {
  description = "Cognito domain prefix"
  type        = string
  default     = "vkp-auth"
}

variable "api_gateway_arn" {
  description = "API Gateway ARN for IAM policies"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

