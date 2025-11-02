# Cognito Module Outputs

output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "The endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.web_client.id
}

output "user_pool_client_secret" {
  description = "The secret of the Cognito User Pool Client (if generated)"
  value       = aws_cognito_user_pool_client.web_client.client_secret
  sensitive   = true
}

output "user_pool_domain" {
  description = "The Cognito User Pool domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_pool_domain_cloudfront" {
  description = "The CloudFront distribution for the Cognito domain"
  value       = aws_cognito_user_pool_domain.main.cloudfront_distribution_arn
}

output "identity_pool_id" {
  description = "The ID of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.main.id
}

output "admin_group_name" {
  description = "The name of the admin group"
  value       = aws_cognito_user_group.admin.name
}

output "user_group_name" {
  description = "The name of the user group"
  value       = aws_cognito_user_group.user.name
}

output "guest_group_name" {
  description = "The name of the guest group"
  value       = aws_cognito_user_group.guest.name
}

output "admin_role_arn" {
  description = "The ARN of the admin IAM role"
  value       = aws_iam_role.cognito_admin.arn
}

output "user_role_arn" {
  description = "The ARN of the user IAM role"
  value       = aws_iam_role.cognito_user.arn
}

output "guest_role_arn" {
  description = "The ARN of the guest IAM role"
  value       = aws_iam_role.cognito_guest.arn
}

output "issuer_url" {
  description = "The issuer URL for JWT validation"
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "jwks_uri" {
  description = "The JWKS URI for JWT validation"
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
}

output "hosted_ui_url" {
  description = "The URL for the Cognito Hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com"
}

output "login_url" {
  description = "The login URL for the Cognito Hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.web_client.id}&response_type=code&scope=email+openid+profile&redirect_uri=${var.callback_urls[0]}"
}

output "logout_url" {
  description = "The logout URL for the Cognito Hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com/logout?client_id=${aws_cognito_user_pool_client.web_client.id}&logout_uri=${var.logout_urls[0]}"
}

