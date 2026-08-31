# API Gateway JWT Authorizer for Cognito.
# Attach per-route via routes[].authorization_type = "JWT" (public paths stay NONE).

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
