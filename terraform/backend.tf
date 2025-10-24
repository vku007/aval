terraform {
  backend "s3" {
    bucket         = "vkp-terraform-state-088455116440"
    key            = "vkp-consulting/terraform.tfstate"
    region         = "eu-north-1"
    encrypt        = true
    dynamodb_table = "vkp-terraform-locks"
  }
}

