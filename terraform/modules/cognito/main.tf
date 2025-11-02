# Cognito User Pool

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # Password policy
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # Username configuration - allow email as username
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Custom attributes
  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 20
    }
  }

  schema {
    name                = "display_name"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 2
      max_length = 100
    }
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF" # Can be set to "AUDIT" or "ENFORCED" for additional security
  }

  # Lambda triggers (will be configured after Lambda functions are created)
  lambda_config {
    pre_sign_up          = aws_lambda_function.pre_signup.arn
    post_confirmation    = aws_lambda_function.post_confirmation.arn
    pre_token_generation = aws_lambda_function.pre_token_generation.arn
  }

  # Deletion protection
  deletion_protection = "ACTIVE"

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-user-pool"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Google Identity Provider
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "email profile openid"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]

  # Callback and logout URLs
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # Supported identity providers
  supported_identity_providers = ["COGNITO", "Google"]

  # Token validity
  id_token_validity      = 60 # minutes
  access_token_validity  = 60 # minutes
  refresh_token_validity = 30 # days

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  # Prevent secret generation (for public clients)
  generate_secret = false

  # Read/write attributes
  read_attributes = [
    "email",
    "name",
    "custom:role",
    "custom:display_name"
  ]

  write_attributes = [
    "email",
    "name",
    "custom:display_name"
  ]

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Enable token revocation
  enable_token_revocation = true

  depends_on = [aws_cognito_identity_provider.google]
}

# Cognito Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

# User Pool Groups
resource "aws_cognito_user_pool_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users with full access including /internal/* endpoints"
  precedence   = 1
  role_arn     = aws_iam_role.cognito_admin.arn
}

resource "aws_cognito_user_pool_group" "user" {
  name         = "user"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Regular users with access to public endpoints"
  precedence   = 2
  role_arn     = aws_iam_role.cognito_user.arn
}

resource "aws_cognito_user_pool_group" "guest" {
  name         = "guest"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Guest users with limited access"
  precedence   = 3
  role_arn     = aws_iam_role.cognito_guest.arn
}

# Cognito Identity Pool (for IAM role assumption)
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}_identity_pool"
  allow_unauthenticated_identities = true
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-identity-pool"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Identity Pool Role Attachment
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated"   = aws_iam_role.cognito_authenticated.arn
    "unauthenticated" = aws_iam_role.cognito_unauthenticated.arn
  }

  role_mapping {
    identity_provider         = "${aws_cognito_user_pool.main.endpoint}:${aws_cognito_user_pool_client.web_client.id}"
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"

    mapping_rule {
      claim      = "cognito:groups"
      match_type = "Contains"
      role_arn   = aws_iam_role.cognito_admin.arn
      value      = "admin"
    }

    mapping_rule {
      claim      = "cognito:groups"
      match_type = "Contains"
      role_arn   = aws_iam_role.cognito_user.arn
      value      = "user"
    }

    mapping_rule {
      claim      = "cognito:groups"
      match_type = "Contains"
      role_arn   = aws_iam_role.cognito_guest.arn
      value      = "guest"
    }
  }
}

