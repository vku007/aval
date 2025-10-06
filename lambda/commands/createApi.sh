#create api gateway v2
# fill in vars
AWS_REGION=eu-north-1 

API_ID=$(aws apigatewayv2 create-api \
  --name vkp-http-api \
  --protocol-type HTTP \
  --cors-configuration '{
    "AllowOrigins": ["https://vkp-consulting.fr","https://www.vkp-consulting.fr"],
    "AllowMethods": ["GET","POST","OPTIONS"],
    "AllowHeaders": ["content-type","authorization"]
  }' \
  --query ApiId --output text --region "$AWS_REGION")

echo $API_ID



