cat > bucket-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::data-1-088455116440",
        "arn:aws:s3:::data-1-088455116440/*"
      ],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "AllowListJsonPrefixToLambdaRole",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::088455116440:role/vkp-api2-service-role" },
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::data-1-088455116440",
      "Condition": { "StringLike": { "s3:prefix": [ "json/*" ] } }
    },
    {
      "Sid": "AllowCRUDJsonObjectsToLambdaRole",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::088455116440:role/vkp-api2-service-role" },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectTagging",  
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::data-1-088455116440/json/*"
    }
  ]
}
JSON

aws s3api put-bucket-policy \
  --bucket data-1-088455116440 \
  --policy file://bucket-policy.json
