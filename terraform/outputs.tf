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

# Cognito Outputs (conditional)
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.enable_cognito_auth ? module.cognito[0].user_pool_id : null
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = var.enable_cognito_auth ? module.cognito[0].user_pool_arn : null
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = var.enable_cognito_auth ? module.cognito[0].user_pool_client_id : null
}

output "cognito_domain" {
  description = "Cognito User Pool Domain"
  value       = var.enable_cognito_auth ? module.cognito[0].user_pool_domain : null
}

output "cognito_hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = var.enable_cognito_auth ? module.cognito[0].hosted_ui_url : null
}

output "cognito_login_url" {
  description = "Cognito Login URL"
  value       = var.enable_cognito_auth ? module.cognito[0].login_url : null
}

output "cognito_logout_url" {
  description = "Cognito Logout URL"
  value       = var.enable_cognito_auth ? module.cognito[0].logout_url : null
}

output "cognito_issuer_url" {
  description = "Cognito Issuer URL for JWT validation"
  value       = var.enable_cognito_auth ? module.cognito[0].issuer_url : null
}

output "cognito_jwks_uri" {
  description = "Cognito JWKS URI for JWT validation"
  value       = var.enable_cognito_auth ? module.cognito[0].jwks_uri : null
}

