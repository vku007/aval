#aws s3 sync ./site s3://vkp-consulting.fr --delete \
#  --cache-control "public,max-age=300"
#aws cloudfront create-invalidation --distribution-id EJWBLACWDMFAZ --paths "/*"


cd ./apiv2
npm ci
npm run build
npm run zip

# Update Lambda via Terraform
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main


