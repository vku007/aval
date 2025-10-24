terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary provider for eu-north-1
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VKP-Consulting"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# Provider for us-east-1 (required for ACM certificates for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "VKP-Consulting"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

