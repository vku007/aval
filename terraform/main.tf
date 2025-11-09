locals {
  common_tags = {
    Project     = "VKP-Consulting"
    ManagedBy   = "Terraform"
    Environment = var.environment
  }
}

# ===== S3 BUCKETS =====

# Static website bucket
module "s3_static_site" {
  source = "./modules/s3-bucket"

  bucket_name         = var.domain_name
  block_public_access = true
  enable_versioning   = false

  # Bucket policy for CloudFront OAC access
  bucket_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontReadObjectsViaOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "arn:aws:s3:::${var.domain_name}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.distribution_arn
          }
        }
      },
      {
        Sid    = "AllowCloudFrontListBucketOptional"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.domain_name}"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.distribution_arn
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# API data bucket
module "s3_api_data" {
  source = "./modules/s3-bucket"

  bucket_name         = var.api_data_bucket_name
  block_public_access = true
  enable_versioning   = false

  # Bucket policy for Lambda access and HTTPS enforcement
  bucket_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:*"
        Resource = [
          "arn:aws:s3:::${var.api_data_bucket_name}",
          "arn:aws:s3:::${var.api_data_bucket_name}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AllowListJsonPrefixToLambdaRole"
        Effect = "Allow"
        Principal = {
          AWS = module.lambda_api2.role_arn
        }
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.api_data_bucket_name}"
        Condition = {
          StringLike = {
            "s3:prefix" = "${var.json_prefix}*"
          }
        }
      },
      {
        Sid    = "AllowCRUDJsonObjectsToLambdaRole"
        Effect = "Allow"
        Principal = {
          AWS = module.lambda_api2.role_arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:PutObjectTagging",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.api_data_bucket_name}/${var.json_prefix}*"
      }
    ]
  })

  tags = local.common_tags
}

# CloudFront logs bucket
module "s3_cloudfront_logs" {
  source = "./modules/s3-bucket"

  bucket_name         = var.cloudfront_logs_bucket_name
  block_public_access = true
  enable_versioning   = false

  tags = local.common_tags
}

# ===== LAMBDA FUNCTIONS =====

# Primary API (vkp-api2-service)
module "lambda_api2" {
  source = "./modules/lambda-function"

  function_name    = "vkp-api2-service"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  lambda_zip_path  = "../apiv2/lambda.zip"
  timeout          = 3
  memory_size      = 128
  log_retention_days = 7

  environment_variables = merge(
    {
      APP_TAG        = "vkp-api"
      MAX_BODY_BYTES = tostring(var.max_body_bytes)
      JSON_PREFIX    = var.json_prefix
      ENVIRONMENT    = var.environment
      BUCKET_NAME    = var.api_data_bucket_name
      CORS_ORIGIN    = "https://${var.domain_name}"
    },
    var.enable_cognito_auth ? {
      USER_POOL_ID = module.cognito[0].user_pool_id
      REGION       = var.aws_region
      CLIENT_ID    = module.cognito[0].user_pool_client_id
    } : {}
  )

  s3_bucket_name = var.api_data_bucket_name
  s3_prefix      = var.json_prefix
  aws_region     = var.aws_region
  create_api_gateway_permission = true

  tags = local.common_tags
}

# Legacy/Alternative API (vkp-simple-service)
module "lambda_simple" {
  source = "./modules/lambda-function"

  function_name    = "vkp-simple-service"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  lambda_zip_path  = "../lambda/lambda.zip"
  timeout          = 3
  memory_size      = 128
  log_retention_days = 7

  environment_variables = {
    MAX_BODY_BYTES = tostring(var.max_body_bytes)
    JSON_PREFIX    = var.json_prefix
    BUCKET_NAME    = var.domain_name
    CORS_ORIGIN    = "https://${var.domain_name}"
  }

  s3_bucket_name = var.domain_name
  s3_prefix      = var.json_prefix
  aws_region     = var.aws_region
  create_api_gateway_permission = true

  tags = local.common_tags
}

# ===== API GATEWAY =====

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/vkp-http-api"
  retention_in_days = 7

  tags = local.common_tags
}

module "api_gateway" {
  source = "./modules/apigateway-http"

  api_name             = "vkp-http-api-4"
  cors_allowed_origins = ["https://vkp-consulting.fr, https://www.vkp-consulting.fr"]
  cors_allowed_methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  cors_allowed_headers = ["content-type", "authorization", "if-match", "if-none-match"]
  cors_max_age         = 0

  lambda_integrations = {
    simple_integration = {
      invoke_arn = module.lambda_simple.invoke_arn
    }
    api2_integration = {
      invoke_arn = module.lambda_api2.invoke_arn
    }
  }

  routes = {
    api_root = {
      route_key       = "ANY /api"
      integration_key = "simple_integration"
    }
    api_proxy = {
      route_key       = "ANY /api/{proxy+}"
      integration_key = "simple_integration"
    }
    apiv2_root = {
      route_key       = "ANY /apiv2"
      integration_key = "api2_integration"
    }
    apiv2_proxy = {
      route_key       = "ANY /apiv2/{proxy+}"
      integration_key = "api2_integration"
    }
  }

  cloudwatch_log_group_arn = aws_cloudwatch_log_group.api_gateway.arn

  tags = local.common_tags
}

# ===== COGNITO AUTHENTICATION =====

module "cognito" {
  count  = var.enable_cognito_auth ? 1 : 0
  source = "./modules/cognito"

  project_name = var.project_name
  environment  = var.environment
  region       = var.aws_region

  # Domain configuration
  domain_prefix = var.cognito_domain_prefix

  # OAuth configuration
  callback_urls = [
    "https://${var.domain_name}/callback",
    "https://${var.domain_name}"
  ]
  logout_urls = [
    "https://${var.domain_name}/logout",
    "https://${var.domain_name}"
  ]

  # Google OAuth (optional)
  enable_google_oauth  = var.enable_google_oauth
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret

  # API Gateway ARN for IAM policies
  api_gateway_arn = module.api_gateway.api_arn

  tags = local.common_tags
}

# ===== CLOUDFRONT =====

module "cloudfront" {
  source = "./modules/cloudfront"

  oac_name            = "OAC-vkp"
  aliases             = [var.domain_name, "www.${var.domain_name}"]
  comment             = "VKP Consulting static site via S3 + CloudFront (OAC)"
  enable_ipv6         = true
  http_version        = "http2"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"

  s3_origin_domain_name = module.s3_static_site.bucket_regional_domain_name
  s3_origin_id          = "s3-origin-vkp"

  api_origin_domain_name = module.api_gateway.api_domain_name
  api_origin_id          = module.api_gateway.api_domain_name

  default_cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized

  ordered_cache_behaviors = [
    {
      path_pattern             = "/api/errors/*"
      target_origin_id         = "s3-origin-vkp"
      allowed_methods          = ["GET", "HEAD"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
      origin_request_policy_id = null
    },
    {
      path_pattern             = "/api/*"
      target_origin_id         = module.api_gateway.api_domain_name
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewer
    },
    {
      path_pattern             = "/apiv2/*"
      target_origin_id         = module.api_gateway.api_domain_name
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewer
    }
  ]

  custom_error_responses = [
    {
      error_code            = 400
      response_code         = "400"
      response_page_path    = "/api/errors/400.html"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 403
      response_code         = "403"
      response_page_path    = "/api/errors/403.html"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 404
      response_code         = "404"
      response_page_path    = "/api/errors/404.html"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 500
      response_code         = "500"
      response_page_path    = "/api/errors/500.html"
      error_caching_min_ttl = 60
    }
  ]

  acm_certificate_arn      = var.acm_certificate_arn
  minimum_protocol_version = "TLSv1.2_2021"

  tags = local.common_tags
}

# ===== ROUTE53 =====

module "route53" {
  source = "./modules/route53"

  zone_id                   = var.route53_zone_id
  domain_name               = var.domain_name
  cloudfront_domain_name    = module.cloudfront.domain_name
  cloudfront_hosted_zone_id = module.cloudfront.hosted_zone_id
}

