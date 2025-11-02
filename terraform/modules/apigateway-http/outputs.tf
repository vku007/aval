output "api_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.main.id
}

output "api_endpoint" {
  description = "Endpoint URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_apigatewayv2_api.main.execution_arn
}

output "api_domain_name" {
  description = "Domain name of the API Gateway"
  value       = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
}

output "stage_id" {
  description = "ID of the default stage"
  value       = aws_apigatewayv2_stage.default.id
}

output "api_arn" {
  description = "ARN of the API Gateway for IAM policies"
  value       = aws_apigatewayv2_api.main.execution_arn
}

