HZ_ID=$(aws route53 list-hosted-zones-by-name --dns-name vkp-consulting.fr \
  --query "HostedZones[0].Id" --output text | sed 's|/hostedzone/||')

# Create a changes.json file with both validation CNAMEs (from step 2) then:
aws route53 change-resource-record-sets --hosted-zone-id $HZ_ID --change-batch file://changes.json