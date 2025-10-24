#!/bin/bash
# Run terraform plan with common options

set -euo pipefail

cd "$(dirname "$0")/.."

echo "📋 Running Terraform plan..."
terraform plan -out=tfplan

echo
echo "✅ Plan saved to tfplan"
echo
echo "To apply this plan, run:"
echo "  terraform apply tfplan"

