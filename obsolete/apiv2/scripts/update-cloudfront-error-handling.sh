#!/bin/bash

# CloudFront Error Handling Update Script
# This script implements the recommended error handling improvements

set -e

# Configuration
DISTRIBUTION_ID="EJWBLACWDMFAZ"
BUCKET_NAME="vkp-consulting.fr"
REGION="eu-north-1"
LOG_BUCKET="vkp-cloudfront-logs"

echo "🚀 Starting CloudFront Error Handling Update..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
if ! command_exists aws; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

if ! command_exists jq; then
    echo "❌ jq not found. Please install jq first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Step 1: Create error pages in S3
echo "📄 Creating error pages in S3..."

# Create error pages directory structure
mkdir -p /tmp/error-pages/api/errors

# 400.html - Bad Request
cat > /tmp/error-pages/api/errors/400.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>400 - Bad Request</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>400</h1>
        <h2>Bad Request</h2>
        <p>The request was invalid or malformed.</p>
        <p>Please check your request and try again.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 403.html - Forbidden
cat > /tmp/error-pages/api/errors/403.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>403 - Forbidden</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>403</h1>
        <h2>Forbidden</h2>
        <p>You don't have permission to access this resource.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 404.html - Not Found
cat > /tmp/error-pages/api/errors/404.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Not Found</h2>
        <p>The requested resource was not found.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 429.html - Too Many Requests
cat > /tmp/error-pages/api/errors/429.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>429 - Too Many Requests</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>429</h1>
        <h2>Too Many Requests</h2>
        <p>You have exceeded the rate limit. Please try again later.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 500.html - Internal Server Error
cat > /tmp/error-pages/api/errors/500.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>500 - Internal Server Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>500</h1>
        <h2>Internal Server Error</h2>
        <p>An unexpected error occurred. Please try again later.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 502.html - Bad Gateway
cat > /tmp/error-pages/api/errors/502.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>502 - Bad Gateway</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>502</h1>
        <h2>Bad Gateway</h2>
        <p>The server received an invalid response from an upstream server.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 503.html - Service Unavailable
cat > /tmp/error-pages/api/errors/503.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>503 - Service Unavailable</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>503</h1>
        <h2>Service Unavailable</h2>
        <p>The service is temporarily unavailable. Please try again later.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# 504.html - Gateway Timeout
cat > /tmp/error-pages/api/errors/504.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>504 - Gateway Timeout</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #636e72 0%, #2d3436 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 3rem; margin: 0 0 20px 0; }
        p { font-size: 1.2rem; margin: 20px 0; }
        a { color: #fff; text-decoration: none; border-bottom: 2px solid #fff; }
        a:hover { border-bottom-color: #ffd700; }
    </style>
</head>
<body>
    <div class="container">
        <h1>504</h1>
        <h2>Gateway Timeout</h2>
        <p>The server did not receive a timely response from an upstream server.</p>
        <p><a href="/">Return to Home</a></p>
    </div>
</body>
</html>
EOF

# Upload error pages to S3
echo "📤 Uploading error pages to S3..."
aws s3 sync /tmp/error-pages/ s3://$BUCKET_NAME/ --region $REGION

echo "✅ Error pages uploaded successfully"

# Step 2: Create logs bucket if it doesn't exist
echo "📊 Setting up CloudFront access logging..."

if ! aws s3 ls s3://$LOG_BUCKET >/dev/null 2>&1; then
    echo "Creating logs bucket: $LOG_BUCKET"
    aws s3 mb s3://$LOG_BUCKET --region $REGION
    
    # Set bucket policy for CloudFront logs
    cat > /tmp/logs-bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AWSCloudFrontLogsDelivery",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::$LOG_BUCKET/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/$DISTRIBUTION_ID"
                }
            }
        },
        {
            "Sid": "AWSCloudFrontLogsDeliveryCheck",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetBucketAcl",
            "Resource": "arn:aws:s3:::$LOG_BUCKET"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket $LOG_BUCKET --policy file:///tmp/logs-bucket-policy.json
    echo "✅ Logs bucket created and configured"
else
    echo "✅ Logs bucket already exists"
fi

# Step 3: Get current distribution config
echo "📋 Getting current distribution configuration..."
aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.DistributionConfig' > /tmp/current-config.json

# Step 4: Update distribution config with enhanced error handling
echo "🔧 Updating distribution configuration..."

# Create updated config with enhanced error responses
jq '.CustomErrorResponses = {
    "Quantity": 8,
    "Items": [
        {
            "ErrorCode": 400,
            "ResponsePagePath": "/api/errors/400.html",
            "ErrorCachingMinTTL": 300,
            "ResponseCode": "400"
        },
        {
            "ErrorCode": 403,
            "ResponsePagePath": "/api/errors/403.html",
            "ErrorCachingMinTTL": 300,
            "ResponseCode": "403"
        },
        {
            "ErrorCode": 404,
            "ResponsePagePath": "/api/errors/404.html",
            "ErrorCachingMinTTL": 300,
            "ResponseCode": "404"
        },
        {
            "ErrorCode": 429,
            "ResponsePagePath": "/api/errors/429.html",
            "ErrorCachingMinTTL": 60,
            "ResponseCode": "429"
        },
        {
            "ErrorCode": 500,
            "ResponsePagePath": "/api/errors/500.html",
            "ErrorCachingMinTTL": 60,
            "ResponseCode": "500"
        },
        {
            "ErrorCode": 502,
            "ResponsePagePath": "/api/errors/502.html",
            "ErrorCachingMinTTL": 60,
            "ResponseCode": "502"
        },
        {
            "ErrorCode": 503,
            "ResponsePagePath": "/api/errors/503.html",
            "ErrorCachingMinTTL": 60,
            "ResponseCode": "503"
        },
        {
            "ErrorCode": 504,
            "ResponsePagePath": "/api/errors/504.html",
            "ErrorCachingMinTTL": 60,
            "ResponseCode": "504"
        }
    ]
} | .Logging = {
    "Enabled": true,
    "IncludeCookies": false,
    "Bucket": "'$LOG_BUCKET'",
    "Prefix": "access-logs/"
}' /tmp/current-config.json > /tmp/updated-config.json

# Get ETag for the update
ETAG=$(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'ETag' --output text)

# Update the distribution
echo "🚀 Updating CloudFront distribution..."
aws cloudfront update-distribution \
    --id $DISTRIBUTION_ID \
    --distribution-config file:///tmp/updated-config.json \
    --if-match $ETAG

echo "✅ Distribution update initiated"

# Step 5: Create CloudWatch alarms
echo "📊 Setting up CloudWatch alarms..."

# Get the account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create alarm for 5xx errors
aws cloudwatch put-metric-alarm \
    --alarm-name "CloudFront-5xx-Errors-$DISTRIBUTION_ID" \
    --alarm-description "High 5xx error rate for CloudFront distribution" \
    --metric-name "5xxErrorRate" \
    --namespace "AWS/CloudFront" \
    --statistic "Average" \
    --period 300 \
    --threshold 5.0 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:$REGION:$ACCOUNT_ID:cloudfront-alerts" \
    --ok-actions "arn:aws:sns:$REGION:$ACCOUNT_ID:cloudfront-alerts" \
    --treat-missing-data "notBreaching" || echo "⚠️  Alarm creation failed (SNS topic may not exist)"

# Create alarm for 4xx errors
aws cloudwatch put-metric-alarm \
    --alarm-name "CloudFront-4xx-Errors-$DISTRIBUTION_ID" \
    --alarm-description "High 4xx error rate for CloudFront distribution" \
    --metric-name "4xxErrorRate" \
    --namespace "AWS/CloudFront" \
    --statistic "Average" \
    --period 300 \
    --threshold 10.0 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:$REGION:$ACCOUNT_ID:cloudfront-alerts" \
    --ok-actions "arn:aws:sns:$REGION:$ACCOUNT_ID:cloudfront-alerts" \
    --treat-missing-data "notBreaching" || echo "⚠️  Alarm creation failed (SNS topic may not exist)"

echo "✅ CloudWatch alarms configured"

# Step 6: Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf /tmp/error-pages
rm -f /tmp/current-config.json /tmp/updated-config.json /tmp/logs-bucket-policy.json

echo ""
echo "🎉 CloudFront Error Handling Update Complete!"
echo ""
echo "📋 Summary of changes:"
echo "✅ Created comprehensive error pages (400, 403, 404, 429, 500, 502, 503, 504)"
echo "✅ Uploaded error pages to S3 bucket"
echo "✅ Updated CloudFront distribution with enhanced error responses"
echo "✅ Enabled CloudFront access logging"
echo "✅ Created CloudWatch alarms for error monitoring"
echo ""
echo "⏳ Note: CloudFront distribution updates can take 15-20 minutes to deploy globally."
echo "📊 Monitor the deployment status with: aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
echo "🔍 Test the error pages:"
echo "   curl -I https://d1kcdf4orzsjcw.cloudfront.net/nonexistent-page"
echo "   curl -I https://d1kcdf4orzsjcw.cloudfront.net/api/nonexistent"
echo ""
echo "📈 View logs:"
echo "   aws s3 ls s3://$LOG_BUCKET/access-logs/"
echo ""
echo "🚨 View alarms:"
echo "   aws cloudwatch describe-alarms --alarm-names CloudFront-5xx-Errors-$DISTRIBUTION_ID CloudFront-4xx-Errors-$DISTRIBUTION_ID"
