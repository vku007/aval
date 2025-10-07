cat > role-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [ "s3:ListBucket" ],
      "Resource": "arn:aws:s3:::data-1-088455116440",
      "Condition": { "StringLike": { "s3:prefix": [ "json/*" ] } }
    },
    {
      "Effect": "Allow",
      "Action": [ "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject" ],
      "Resource": "arn:aws:s3:::data-1-088455116440/json/*"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name "vkp-api2-service-role" \
  --policy-name "S3JsonAccess-data-1-088455116440" \
  --policy-document file://role-policy.json
