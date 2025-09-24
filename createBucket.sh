AWS_REGION= eu-north-1  # or your preferred region
DOMAIN=vkp-consulting.fr

aws s3api create-bucket \
  --bucket $DOMAIN \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION

# Block public access (we'll use CloudFront OAC)
aws s3api put-public-access-block --bucket $DOMAIN --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create a basic site skeleton locally and upload
mkdir site && cat > site/index.html <<'HTML'
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>VKP Consulting</title>
<link rel="icon" href="data:,">
<style>body{font:16px/1.5 system-ui;margin:0;display:grid;place-items:center;height:100vh}
.card{max-width:640px;padding:2rem;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{margin:0 0 .5rem} .muted{color:#555}</style>
<body><div class="card">
<h1>VKP Consulting</h1>
<p class="muted">Technology consulting & software delivery.</p>
<p>Contact: <a href="mailto:hello@vkp-consulting.fr">hello@vkp-consulting.fr</a></p>
</div></body>
</html>
HTML

aws s3 sync ./site s3://$DOMAIN --delete \
  --cache-control "public,max-age=300"  # short cache for html while iterating
