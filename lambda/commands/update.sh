FUNC=vkp-simple-service
AWS_REGION=eu-north-1  

aws lambda update-function-code --function-name "$FUNC" --zip-file fileb://../lambda.zip --region "$AWS_REGION"