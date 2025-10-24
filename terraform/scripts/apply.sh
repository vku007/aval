#!/bin/bash
# Run terraform apply with safety checks

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f "tfplan" ]; then
  echo "❌ No plan file found. Run ./scripts/plan.sh first"
  exit 1
fi

echo "🚀 Applying Terraform plan..."
echo

read -p "Are you sure you want to apply? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

terraform apply tfplan

rm -f tfplan

echo
echo "✅ Apply complete!"

