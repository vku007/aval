## Infrastructure (Terraform)

- Location: `/terraform/`
- Modules: s3-bucket, lambda-function, apigateway-http, cloudfront, route53
- State: S3 backend (vkp-terraform-state-088455116440)
- Region: eu-north-1

Commands:
```bash
cd terraform
terraform plan    # Always review first
terraform apply   # Apply changes
terraform state list  # View managed resources
```