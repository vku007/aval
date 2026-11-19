resource "aws_cloudfront_origin_access_control" "main" {
  name                              = var.oac_name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Viewer-request: /aval/ → /aval/index.html (S3 REST + OAC has no directory index)
resource "aws_cloudfront_function" "rewrite_index" {
  name    = var.rewrite_index_function_name
  runtime = "cloudfront-js-2.0"
  comment = "Append index.html for directory URLs"
  publish = true
  code    = file("${path.module}/functions/rewrite-index.js")
}

resource "aws_cloudfront_function" "editor_gate" {
  name    = "vkp-editor-gate"
  runtime = "cloudfront-js-2.0"
  comment = "Require CloudFront signed cookies for the campaign editor, then append index.html"
  publish = true
  code    = file("${path.module}/functions/editor-gate.js")
}

resource "aws_cloudfront_cache_policy" "editor" {
  name        = "vkp-editor-origin-cache"
  comment     = "Honor Cache-Control from the editor objects"
  default_ttl = 0
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

resource "aws_cloudfront_response_headers_policy" "editor" {
  name    = "vkp-editor-headers"
  comment = "Security headers for the campaign editor"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
      override                = true
    }
  }
}

locals {
  editor_behaviors = [
    {
      path_pattern               = "/editor/session.html"
      target_origin_id           = var.s3_origin_id
      allowed_methods            = ["GET", "HEAD"]
      cached_methods             = ["GET", "HEAD"]
      cache_policy_id            = aws_cloudfront_cache_policy.editor.id
      origin_request_policy_id   = null
      function_arn               = null
      trusted_key_group_ids      = null
      response_headers_policy_id = null
    },
    {
      path_pattern               = "/editor/*"
      target_origin_id           = var.s3_origin_id
      allowed_methods            = ["GET", "HEAD"]
      cached_methods             = ["GET", "HEAD"]
      cache_policy_id            = aws_cloudfront_cache_policy.editor.id
      origin_request_policy_id   = null
      function_arn               = aws_cloudfront_function.editor_gate.arn
      trusted_key_group_ids      = [var.editor_key_group_id]
      response_headers_policy_id = aws_cloudfront_response_headers_policy.editor.id
    }
  ]
  ordered_cache_behaviors = concat(local.editor_behaviors, var.ordered_cache_behaviors)
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = var.enable_ipv6
  http_version        = var.http_version
  price_class         = var.price_class
  default_root_object = var.default_root_object
  aliases             = var.aliases
  comment             = var.comment

  # S3 Origin
  origin {
    domain_name              = var.s3_origin_domain_name
    origin_id                = var.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  # API Gateway Origin
  dynamic "origin" {
    for_each = var.api_origin_domain_name != null ? [1] : []
    content {
      domain_name = var.api_origin_domain_name
      origin_id   = var.api_origin_id

      custom_origin_config {
        http_port                = 80
        https_port               = 443
        origin_protocol_policy   = "https-only"
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_read_timeout      = 30
        origin_keepalive_timeout = 5
      }
    }
  }

  # Default cache behavior (S3)
  default_cache_behavior {
    target_origin_id       = var.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = var.default_cache_policy_id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite_index.arn
    }
  }

  # Cache behaviors for specific paths
  dynamic "ordered_cache_behavior" {
    for_each = local.ordered_cache_behaviors
    content {
      path_pattern               = ordered_cache_behavior.value.path_pattern
      target_origin_id           = ordered_cache_behavior.value.target_origin_id
      viewer_protocol_policy     = "redirect-to-https"
      allowed_methods            = ordered_cache_behavior.value.allowed_methods
      cached_methods             = ordered_cache_behavior.value.cached_methods
      compress                   = true
      cache_policy_id            = ordered_cache_behavior.value.cache_policy_id
      origin_request_policy_id   = lookup(ordered_cache_behavior.value, "origin_request_policy_id", null)
      response_headers_policy_id = lookup(ordered_cache_behavior.value, "response_headers_policy_id", null)
      trusted_key_groups         = lookup(ordered_cache_behavior.value, "trusted_key_group_ids", null)

      dynamic "function_association" {
        for_each = ordered_cache_behavior.value.function_arn == null ? [] : [ordered_cache_behavior.value.function_arn]
        content {
          event_type   = "viewer-request"
          function_arn = function_association.value
        }
      }
    }
  }

  # Custom error responses
  dynamic "custom_error_response" {
    for_each = var.custom_error_responses
    content {
      error_code            = custom_error_response.value.error_code
      response_code         = lookup(custom_error_response.value, "response_code", null)
      response_page_path    = lookup(custom_error_response.value, "response_page_path", null)
      error_caching_min_ttl = lookup(custom_error_response.value, "error_caching_min_ttl", 300)
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = var.minimum_protocol_version
  }

  tags = var.tags
}

