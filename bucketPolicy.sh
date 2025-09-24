BUCKET="vkp-consulting.fr"             # your content bucket
DIST_ID="EJWBLACWDMFAZ"                # your CloudFront distribution id
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

sed -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" \
    -e "s/DIST_ID/$DIST_ID/g" bucket-policy.json > bucket-policy.final.json
