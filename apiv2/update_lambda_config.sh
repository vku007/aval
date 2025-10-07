aws lambda update-function-configuration \
  --function-name vkp-api2-service \
  --region eu-north-1 \
  --environment "Variables={
    BUCKET_NAME=data-1-088455116440,
    JSON_PREFIX=json/,
    CORS_ORIGIN=https://vkp-consulting.fr,
    APP_TAG=vkp-api,
    ENVIRONMENT=prod,
    MAX_BODY_BYTES=1048576
  }"