## Deployment Workflow

1. **Infrastructure Changes**:
   ```bash
   cd terraform
   terraform plan
   terraform apply
   ```

2. **API Code Changes**:
   ```bash
cd ./apiv2
npm ci
npm run build
npm run zip

# Update Lambda via Terraform
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main

   ```

3. **Static Site Updates**:
   ```bash
   aws s3 sync site/ s3://vkp-consulting.fr/
   aws cloudfront create-invalidation --distribution-id EJWBLACWDMFAZ --paths "/*"
   ```