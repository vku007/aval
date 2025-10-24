resource "aws_cloudfront_origin_access_control" "main" {
  name                              = var.oac_name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
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
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
        origin_read_timeout    = 30
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
  }

  # Cache behaviors for specific paths
  dynamic "ordered_cache_behavior" {
    for_each = var.ordered_cache_behaviors
    content {
      path_pattern           = ordered_cache_behavior.value.path_pattern
      target_origin_id       = ordered_cache_behavior.value.target_origin_id
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ordered_cache_behavior.value.allowed_methods
      cached_methods         = ordered_cache_behavior.value.cached_methods
      compress               = true
      cache_policy_id        = ordered_cache_behavior.value.cache_policy_id
      origin_request_policy_id = lookup(ordered_cache_behavior.value, "origin_request_policy_id", null)
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

