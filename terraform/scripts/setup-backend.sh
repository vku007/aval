#!/bin/bash
# Setup Terraform backend (S3 + DynamoDB)

set -euo pipefail

AWS_REGION="eu-north-1"
AWS_ACCOUNT_ID="088455116440"
STATE_BUCKET="vkp-terraform-state-${AWS_ACCOUNT_ID}"
LOCK_TABLE="vkp-terraform-locks"

echo "🔧 Setting up Terraform backend infrastructure..."
echo "   Region: ${AWS_REGION}"
echo "   State Bucket: ${STATE_BUCKET}"
echo "   Lock Table: ${LOCK_TABLE}"
echo

# Create S3 bucket for state
echo "📦 Creating S3 bucket for Terraform state..."
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "   ✓ Bucket ${STATE_BUCKET} already exists"
else
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${AWS_REGION}" \
    --create-bucket-configuration LocationConstraint="${AWS_REGION}"
  echo "   ✓ Created bucket ${STATE_BUCKET}"
fi

# Enable versioning
echo "🔄 Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled
echo "   ✓ Versioning enabled"

# Enable encryption
echo "🔒 Enabling encryption..."
aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
echo "   ✓ Encryption enabled"

# Block public access
echo "🚫 Blocking public access..."
aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "   ✓ Public access blocked"

# Create DynamoDB table for state locking
echo "🔐 Creating DynamoDB table for state locking..."
if aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${AWS_REGION}" 2>/dev/null; then
  echo "   ✓ Table ${LOCK_TABLE} already exists"
else
  aws dynamodb create-table \
    --table-name "${LOCK_TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${AWS_REGION}" \
    --tags Key=Project,Value=VKP-Consulting Key=ManagedBy,Value=Terraform
  
  echo "   ⏳ Waiting for table to be active..."
  aws dynamodb wait table-exists --table-name "${LOCK_TABLE}" --region "${AWS_REGION}"
  echo "   ✓ Table ${LOCK_TABLE} created"
fi

echo
echo "✅ Terraform backend setup complete!"
echo
echo "Next steps:"
echo "  1. cd terraform/"
echo "  2. terraform init"
echo "  3. terraform plan"

