data "aws_caller_identity" "current" {}

resource "aws_lambda_function" "main" {
  function_name    = var.function_name
  role             = aws_iam_role.main.arn
  handler          = var.handler
  runtime          = var.runtime
  architectures    = var.architectures
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  environment {
    variables = var.environment_variables
  }

  timeout     = var.timeout
  memory_size = var.memory_size

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "main" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_lambda_permission" "api_gateway" {
  count = var.create_api_gateway_permission ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*/*/*"
}

