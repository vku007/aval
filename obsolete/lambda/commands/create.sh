AWS_REGION=eu-north-1             # pick your region for the function
FUNC=vkp-simple-service

# Trust policy (Lambda assumes this role)
#cat > trust.json <<'JSON'
#{ "Version": "2012-10-17", "Statement": [
 # { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }
#]}
#JSON

ROLE_ARN=arn:aws:iam::088455116440:role/vkp-simple-service-role

#ROLE_ARN=$(aws iam create-role --role-name ${FUNC}-role \
 # --assume-role-policy-document file://trust.json \
 # --query Role.Arn --output text)

# Basic execution (writes logs to CloudWatch)
#aws iam attach-role-policy --role-name ${FUNC}-role \
 # --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create the function (Node.js 20.x, ESM bundle)
aws lambda create-function \
  --function-name "$FUNC" \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler index.handler \
  --architectures arm64 \
  --zip-file fileb://../lambda.zip \
  --environment "Variables={CORS_ORIGIN=https://vkp-consulting.fr}" \
  --region "$AWS_REGION"
