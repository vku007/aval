# VKP REST API

A comprehensive file and user management system built with AWS Lambda, featuring CRUD operations, ETag-based concurrency control, and RFC 7807 error responses.

## 🚀 Features

- **Dual Resource Management**: Handle both generic JSON files and structured user entities
- **Concurrency Control**: ETag-based optimistic locking for safe concurrent updates
- **Standard Compliance**: RFC 7807 problem+json error responses
- **Pagination Support**: Cursor-based pagination for large datasets
- **CORS Enabled**: Cross-origin resource sharing for web applications
- **Validation**: Comprehensive input validation with Zod schemas
- **Testing**: 95%+ code coverage with Vitest

## 📋 Quick Start

### Prerequisites

- Node.js 20.x or later
- AWS CLI configured
- Access to an S3 bucket

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd apiv2

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Deploy to AWS
npm run deploy
```

### Environment Variables

```bash
# Required
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name

# Optional
API_BASE_URL=https://your-api-gateway-url.amazonaws.com
CORS_ORIGIN=https://vkp-consulting.fr
```

## 📚 API Documentation

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/apiv2/files` | GET | List all files |
| `/apiv2/files` | POST | Create new file |
| `/apiv2/files/{id}` | GET | Get file by ID |
| `/apiv2/files/{id}` | PUT | Replace file content |
| `/apiv2/files/{id}` | PATCH | Merge file content |
| `/apiv2/files/{id}` | DELETE | Delete file |
| `/apiv2/files/{id}/meta` | GET | Get file metadata |
| `/apiv2/users` | GET | List all users |
| `/apiv2/users` | POST | Create new user |
| `/apiv2/users/{id}` | GET | Get user by ID |
| `/apiv2/users/{id}` | PUT | Replace user data |
| `/apiv2/users/{id}` | PATCH | Merge user data |
| `/apiv2/users/{id}` | DELETE | Delete user |
| `/apiv2/users/{id}/meta` | GET | Get user metadata |

### Example Usage

```bash
# Create a configuration file
curl -X POST https://your-api.com/apiv2/files \
  -H "Content-Type: application/json" \
  -d '{
    "id": "app-config",
    "data": {
      "database": {"host": "localhost", "port": 5432},
      "features": ["auth", "logging"]
    }
  }'

# Create a user
curl -X POST https://your-api.com/apiv2/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "name": "John Doe",
    "externalId": 1001
  }'

# Get a file with ETag
curl -H "If-None-Match: \"abc123\"" \
  https://your-api.com/apiv2/files/config

# Update with concurrency control
curl -X PUT https://your-api.com/apiv2/files/config \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"setting": "new-value"}'
```

## 🏗️ Architecture

### Domain Layer
- **BaseEntity**: Abstract base class for all entities
- **JsonEntity**: Generic JSON document entity
- **User**: User entity with name and externalId

### Application Layer
- **Services**: Business logic and orchestration
- **DTOs**: Data transfer objects for API contracts
- **Validation**: Zod schemas for input validation

### Infrastructure Layer
- **S3EntityRepository**: S3-based entity persistence
- **S3UserRepository**: User-specific S3 operations
- **AWS SDK v3**: Modern AWS service integration

### Presentation Layer
- **Controllers**: HTTP request/response handling
- **Error Handling**: RFC 7807 compliant error responses
- **CORS**: Cross-origin resource sharing

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test S3EntityRepository.test.ts
```

### Test Structure

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end API testing
- **Mocking**: AWS SDK v3 service mocking

## 📁 Project Structure

```
apiv2/
├── src/
│   ├── domain/                 # Domain entities and business logic
│   │   ├── entities/
│   │   └── repositories/
│   ├── application/            # Application services and DTOs
│   │   ├── dto/
│   │   └── services/
│   ├── infrastructure/         # External service implementations
│   │   └── persistence/
│   ├── presentation/           # HTTP controllers and routing
│   │   └── controllers/
│   └── index.ts               # Lambda entry point
├── tests/                     # Test files
├── docs/                      # Documentation
├── API_DOCUMENTATION.md       # Comprehensive API docs
├── API_REFERENCE.md           # Quick reference guide
├── openapi.yaml               # OpenAPI specification
└── README.md                  # This file
```

## 🔧 Configuration

### S3 Bucket Setup

```bash
# Create S3 bucket
aws s3 mb s3://your-bucket-name

# Configure CORS
aws s3api put-bucket-cors \
  --bucket your-bucket-name \
  --cors-configuration file://cors.json
```

### API Gateway Configuration

```bash
# Deploy API Gateway
npm run deploy:api

# Configure custom domain (optional)
npm run deploy:domain
```

## 🚀 Deployment

### AWS Lambda

```bash
# Build and package
npm run build

# Deploy Lambda function
npm run deploy:lambda

# Update function configuration
npm run deploy:config
```

### CloudFront Distribution

```bash
# Deploy CloudFront
npm run deploy:cloudfront

# Invalidate cache
npm run invalidate:cache
```

## 📊 Monitoring

### CloudWatch Logs

```bash
# View logs
aws logs tail /aws/lambda/vkp-simple-service --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/vkp-simple-service \
  --filter-pattern "ERROR"
```

### Metrics

- **Request Count**: Total API requests
- **Error Rate**: 4xx and 5xx response rates
- **Latency**: Response time percentiles
- **Concurrency**: Active Lambda executions

## 🔒 Security

### CORS Configuration

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://vkp-consulting.fr"],
      "AllowedMethods": ["GET", "POST", "PUT", "PATCH", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### Input Validation

- **ID Validation**: Alphanumeric, dots, hyphens, underscores only
- **Size Limits**: 1MB payload maximum
- **Content Type**: application/json required
- **ETag Validation**: Strong ETag format enforcement

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage above 95%
- Use conventional commit messages
- Update documentation for API changes

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: See `API_DOCUMENTATION.md` for detailed API docs
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 🔄 Changelog

### v2.0.0
- Added user entity management
- Unified file and user operations
- Enhanced error handling with RFC 7807
- Improved test coverage
- Added comprehensive documentation

### v1.0.0
- Initial release with basic file operations
- ETag-based concurrency control
- S3 integration
- Basic CRUD operations