variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-north-1"
}

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
  default     = "088455116440"
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "vkp-consulting.fr"
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://vkp-consulting.fr", "https://www.vkp-consulting.fr"]
}

variable "api_data_bucket_name" {
  description = "S3 bucket name for API data storage"
  type        = string
  default     = "data-1-088455116440"
}

variable "cloudfront_logs_bucket_name" {
  description = "S3 bucket name for CloudFront logs"
  type        = string
  default     = "vkp-cloudfront-logs"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
  default     = "arn:aws:acm:us-east-1:088455116440:certificate/e3774345-7028-415a-ab57-bd1f8e02a021"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = "Z094077718N53LUC7MTBL"
}

variable "max_body_bytes" {
  description = "Maximum request body size in bytes"
  type        = number
  default     = 1048576 # 1MB
}

variable "json_prefix" {
  description = "S3 prefix for JSON data"
  type        = string
  default     = "json/"
}

