AWS_REGION="eu-north-1"
ACCOUNT_ID="088455116440"
API_ID="wmrksdxxml"
FUNC_NAME="vkp-api2-service"

# 1) Inspect current Lambda resource policy (so you can see the wrong one)
aws lambda get-policy --region "$AWS_REGION" --function-name "$FUNC_NAME" --query Policy --output text | jq .

# 2) (Optional) remove the incorrect statement that used /apiv2*
#    Replace BAD_SID below with the Sid you saw in step 1 (if any)
# aws lambda remove-permission --region "$AWS_REGION" --function-name "$FUNC_NAME" --statement-id BAD_SID

# 3) Add correct permissions (base and proxy)
aws lambda add-permission \
  --region "$AWS_REGION" \
  --function-name "$FUNC_NAME" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --statement-id "apiv2-base-$(date +%s)" \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/apiv2"

aws lambda add-permission \
  --region "$AWS_REGION" \
  --function-name "$FUNC_NAME" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --statement-id "apiv2-proxy-$(date +%s)" \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/apiv2/*"
