aws s3 sync ./site s3://vkp-consulting.fr --delete \
  --cache-control "public,max-age=300"
aws cloudfront create-invalidation --distribution-id EJWBLACWDMFAZ --paths "/*"
