# Additional variables for authentication

variable "cognito_client_id" {
  description = "Cognito User Pool Client ID for JWT validation"
  type        = string
  default     = ""
}

variable "cognito_issuer_url" {
  description = "Cognito issuer URL for JWT validation"
  type        = string
  default     = ""
}

variable "enable_jwt_authorizer" {
  description = "Enable JWT authorizer for API Gateway"
  type        = bool
  default     = false
}

