# API Gateway JWT Authorizer for Cognito

resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  count = var.enable_jwt_authorizer && var.cognito_issuer_url != "" ? 1 : 0

  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = var.cognito_issuer_url
  }
}

# Update existing routes to use JWT authorizer
# Note: This assumes the routes are already defined in main.tf

# You'll need to add authorization_type and authorizer_id to existing routes
# Example:
# resource "aws_apigatewayv2_route" "api2_with_auth" {
#   api_id             = aws_apigatewayv2_api.main.id
#   route_key          = "ANY /apiv2/{proxy+}"
#   target             = "integrations/${aws_apigatewayv2_integration.api2.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
# }

