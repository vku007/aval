variable "api_name" {
  description = "Name of the API Gateway"
  type        = string
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "List of allowed HTTP methods for CORS"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}

variable "cors_allowed_headers" {
  description = "List of allowed headers for CORS"
  type        = list(string)
  default     = ["content-type", "authorization", "if-match", "if-none-match"]
}

variable "cors_max_age" {
  description = "Max age for CORS preflight requests"
  type        = number
  default     = 0
}

variable "lambda_integrations" {
  description = "Map of Lambda function integrations"
  type = map(object({
    invoke_arn = string
  }))
  default = {}
}

variable "routes" {
  description = "Map of routes to create"
  type = map(object({
    route_key       = string
    integration_key = string
  }))
  default = {}
}

variable "cloudwatch_log_group_arn" {
  description = "CloudWatch Log Group ARN for access logs"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

