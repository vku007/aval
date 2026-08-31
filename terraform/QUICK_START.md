# Terraform Quick Start

Day-to-day workflow for the existing VKP stack. Full reference: [README.md](README.md).

## First clone

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # then fill real values
terraform init
terraform plan
```

Backend S3/DynamoDB already exist. Do not re-import resources.

## Daily: infrastructure change

```bash
cd terraform
# edit .tf files
./scripts/plan.sh
# review the plan
./scripts/apply.sh
```

## Deploy API v2 Lambda

```bash
cd apiv2
npm ci && npm test && npm run build && npm run zip
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

Or from repo root: `./deployUpdate.sh`

## Common commands

```bash
terraform state list
terraform show module.lambda_api2.aws_lambda_function.main
terraform output
terraform output api_gateway_url
terraform output cognito_user_pool_id
terraform fmt -recursive
terraform validate
```

## Notes

1. Always `plan` before `apply`
2. Never commit `terraform.tfvars`
3. State is in S3 with DynamoDB locking

## Rollback Lambda only

```bash
cd apiv2
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://lambda.zip \
  --region eu-north-1
```
