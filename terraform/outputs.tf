output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = module.api_gateway.api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = module.api_gateway.api_id
}

output "cloudfront_url" {
  description = "CloudFront distribution domain name"
  value       = "https://${module.cloudfront.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "website_url" {
  description = "Main website URL"
  value       = "https://${var.domain_name}"
}

output "lambda_api2_function_name" {
  description = "Lambda API2 function name"
  value       = module.lambda_api2.function_name
}

output "lambda_simple_function_name" {
  description = "Lambda Simple function name"
  value       = module.lambda_simple.function_name
}

output "s3_static_bucket" {
  description = "S3 static site bucket name"
  value       = module.s3_static_site.bucket_id
}

output "s3_api_data_bucket" {
  description = "S3 API data bucket name"
  value       = module.s3_api_data.bucket_id
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = module.route53.zone_id
}

output "route53_name_servers" {
  description = "Route53 name servers"
  value       = module.route53.name_servers
}

