# IAM Roles for Cognito

# IAM Role for Lambda Triggers
resource "aws_iam_role" "cognito_lambda" {
  name = "${var.project_name}-cognito-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-lambda-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "cognito_lambda_basic" {
  role       = aws_iam_role.cognito_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for Lambda triggers to interact with Cognito
resource "aws_iam_role_policy" "cognito_lambda_cognito_access" {
  name = "cognito-access"
  role = aws_iam_role.cognito_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser"
        ]
        Resource = aws_cognito_user_pool.main.arn
      }
    ]
  })
}

# IAM Role for Authenticated Cognito Users (default)
resource "aws_iam_role" "cognito_authenticated" {
  name = "${var.project_name}-cognito-authenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-authenticated-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# IAM Role for Unauthenticated Cognito Users
resource "aws_iam_role" "cognito_unauthenticated" {
  name = "${var.project_name}-cognito-unauthenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-unauthenticated-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# IAM Role for Admin Users
resource "aws_iam_role" "cognito_admin" {
  name = "${var.project_name}-cognito-admin-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-admin-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Policy for Admin users - Allow access to /internal/* endpoints
resource "aws_iam_role_policy" "cognito_admin_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/*/apiv2/internal/*"
        ]
      }
    ]
  })
}

# IAM Role for Regular Users
resource "aws_iam_role" "cognito_user" {
  name = "${var.project_name}-cognito-user-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-user-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Policy for Regular users - Deny access to /internal/* endpoints
resource "aws_iam_role_policy" "cognito_user_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_user.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/*/apiv2/internal/*"
        ]
      }
    ]
  })
}

# IAM Role for Guest Users
resource "aws_iam_role" "cognito_guest" {
  name = "${var.project_name}-cognito-guest-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-cognito-guest-role"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Policy for Guest users - Deny access to /internal/* endpoints
resource "aws_iam_role_policy" "cognito_guest_api_access" {
  name = "api-access"
  role = aws_iam_role.cognito_guest.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = [
          "${var.api_gateway_arn}/*/*/apiv2/internal/*"
        ]
      }
    ]
  })
}

