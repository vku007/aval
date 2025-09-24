CERT_ARN=$(aws acm request-certificate --region us-east-1 \
  --domain-name vkp-consulting.fr \
  --subject-alternative-names www.vkp-consulting.fr \
  --validation-method DNS \
  --query CertificateArn --output text)

echo $CERT_ARN
