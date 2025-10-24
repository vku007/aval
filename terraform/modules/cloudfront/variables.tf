variable "oac_name" {
  description = "Name of the Origin Access Control"
  type        = string
  default     = "OAC-vkp"
}

variable "aliases" {
  description = "List of domain aliases for the distribution"
  type        = list(string)
  default     = []
}

variable "comment" {
  description = "Comment for the distribution"
  type        = string
  default     = ""
}

variable "enable_ipv6" {
  description = "Enable IPv6"
  type        = bool
  default     = true
}

variable "http_version" {
  description = "HTTP version"
  type        = string
  default     = "http2"
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "default_root_object" {
  description = "Default root object"
  type        = string
  default     = "index.html"
}

variable "s3_origin_domain_name" {
  description = "S3 origin domain name"
  type        = string
}

variable "s3_origin_id" {
  description = "S3 origin ID"
  type        = string
  default     = "s3-origin-vkp"
}

variable "api_origin_domain_name" {
  description = "API Gateway origin domain name"
  type        = string
  default     = null
}

variable "api_origin_id" {
  description = "API origin ID"
  type        = string
  default     = "api-origin"
}

variable "default_cache_policy_id" {
  description = "Default cache policy ID"
  type        = string
  default     = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
}

variable "ordered_cache_behaviors" {
  description = "Ordered cache behaviors"
  type = list(object({
    path_pattern             = string
    target_origin_id         = string
    allowed_methods          = list(string)
    cached_methods           = list(string)
    cache_policy_id          = string
    origin_request_policy_id = optional(string)
  }))
  default = []
}

variable "custom_error_responses" {
  description = "Custom error responses"
  type = list(object({
    error_code            = number
    response_code         = optional(string)
    response_page_path    = optional(string)
    error_caching_min_ttl = optional(number)
  }))
  default = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1)"
  type        = string
}

variable "minimum_protocol_version" {
  description = "Minimum TLS protocol version"
  type        = string
  default     = "TLSv1.2_2021"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

