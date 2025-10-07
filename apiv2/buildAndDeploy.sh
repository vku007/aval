npm i
npm run build
npm run zip
# then:
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://lambda.zip \
  --region eu-north-1
