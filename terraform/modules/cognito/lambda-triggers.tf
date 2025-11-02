# Lambda Triggers for Cognito

# Pre-Signup Lambda Function
resource "aws_lambda_function" "pre_signup" {
  filename         = "${path.module}/../../../lambda/cognito-triggers/dist/pre-signup.zip"
  function_name    = "${var.project_name}-cognito-pre-signup"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10
  memory_size     = 256

  source_code_hash = fileexists("${path.module}/../../../lambda/cognito-triggers/dist/pre-signup.zip") ? filebase64sha256("${path.module}/../../../lambda/cognito-triggers/dist/pre-signup.zip") : null

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
      REGION       = var.region
    }
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-pre-signup"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Lambda permission for Cognito to invoke pre-signup
resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Post-Confirmation Lambda Function
resource "aws_lambda_function" "post_confirmation" {
  filename         = "${path.module}/../../../lambda/cognito-triggers/dist/post-confirmation.zip"
  function_name    = "${var.project_name}-cognito-post-confirmation"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10
  memory_size     = 256

  source_code_hash = fileexists("${path.module}/../../../lambda/cognito-triggers/dist/post-confirmation.zip") ? filebase64sha256("${path.module}/../../../lambda/cognito-triggers/dist/post-confirmation.zip") : null

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
      REGION       = var.region
    }
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-post-confirmation"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Lambda permission for Cognito to invoke post-confirmation
resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Pre-Token-Generation Lambda Function
resource "aws_lambda_function" "pre_token_generation" {
  filename         = "${path.module}/../../../lambda/cognito-triggers/dist/pre-token-generation.zip"
  function_name    = "${var.project_name}-cognito-pre-token-generation"
  role            = aws_iam_role.cognito_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 10
  memory_size     = 256

  source_code_hash = fileexists("${path.module}/../../../lambda/cognito-triggers/dist/pre-token-generation.zip") ? filebase64sha256("${path.module}/../../../lambda/cognito-triggers/dist/pre-token-generation.zip") : null

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
      REGION       = var.region
    }
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-pre-token-generation"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Lambda permission for Cognito to invoke pre-token-generation
resource "aws_lambda_permission" "cognito_pre_token_generation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token_generation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${aws_lambda_function.pre_signup.function_name}"
  retention_in_days = 7

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-pre-signup-logs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

resource "aws_cloudwatch_log_group" "post_confirmation" {
  name              = "/aws/lambda/${aws_lambda_function.post_confirmation.function_name}"
  retention_in_days = 7

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-post-confirmation-logs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

resource "aws_cloudwatch_log_group" "pre_token_generation" {
  name              = "/aws/lambda/${aws_lambda_function.pre_token_generation.function_name}"
  retention_in_days = 7

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-pre-token-generation-logs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

