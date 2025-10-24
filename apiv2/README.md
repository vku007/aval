# VKP REST API

A comprehensive file, user, and game management system built with AWS Lambda, featuring CRUD operations, ETag-based concurrency control, and RFC 7807 error responses.

## 🚀 Features

- **Triple Resource Management**: Handle generic JSON files, structured user entities, and complex game entities
- **Concurrency Control**: ETag-based optimistic locking for safe concurrent updates
- **Standard Compliance**: RFC 7807 problem+json error responses
- **Pagination Support**: Cursor-based pagination for large datasets
- **CORS Enabled**: Cross-origin resource sharing for web applications
- **Validation**: Comprehensive input validation with Zod schemas
- **Testing**: 95%+ code coverage with Vitest
- **Game Management**: Complete game lifecycle with rounds, moves, and state management
- **Infrastructure as Code**: Complete Terraform setup in `../terraform/`

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
API_BASE_URL=https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com
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
| `/apiv2/games` | GET | List all games |
| `/apiv2/games` | POST | Create new game |
| `/apiv2/games/{id}` | GET | Get game by ID |
| `/apiv2/games/{id}` | PUT | Replace game data |
| `/apiv2/games/{id}` | PATCH | Merge game data |
| `/apiv2/games/{id}` | DELETE | Delete game |
| `/apiv2/games/{id}/meta` | GET | Get game metadata |
| `/apiv2/games/{id}/rounds` | POST | Add round to game |
| `/apiv2/games/{gameId}/rounds/{roundId}/moves` | POST | Add move to round |
| `/apiv2/games/{gameId}/rounds/{roundId}/finish` | PATCH | Finish round |
| `/apiv2/games/{id}/finish` | PATCH | Finish game |

### Example Usage

```bash
# Create a configuration file
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/files \
  -H "Content-Type: application/json" \
  -d '{
    "id": "app-config",
    "data": {
      "database": {"host": "localhost", "port": 5432},
      "features": ["auth", "logging"]
    }
  }'

# Create a user
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "name": "John Doe",
    "externalId": 1001
  }'

# Create a game
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/games \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tournament-2024",
    "type": "tournament",
    "usersIds": ["player1", "player2"],
    "rounds": [],
    "isFinished": false
  }'

# Add a round to the game
curl -X POST https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/games/tournament-2024/rounds \
  -H "Content-Type: application/json" \
  -H "If-Match: \"your-etag-here\"" \
  -d '{
    "id": "round-1",
    "moves": [],
    "isFinished": false
  }'

# Get a file with ETag
curl -H "If-None-Match: \"abc123\"" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/files/config

# Update with concurrency control
curl -X PUT https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/files/config \
  -H "Content-Type: application/json" \
  -H "If-Match: \"abc123\"" \
  -d '{"setting": "new-value"}'
```

## 🏗️ Architecture

### Domain Layer
- **BaseEntity**: Abstract base class for all entities
- **JsonEntity**: Generic JSON document entity
- **User**: User entity with name and externalId
- **GameEntity**: Game entity with rounds, moves, and state management
- **Round**: Round entity containing moves and completion status
- **Move**: Move entity with user, value, and decorated value

### Application Layer
- **Services**: Business logic and orchestration
- **DTOs**: Data transfer objects for API contracts
- **Validation**: Zod schemas for input validation

### Infrastructure Layer
- **S3EntityRepository**: S3-based entity persistence
- **S3UserRepository**: User-specific S3 operations
- **S3GameRepository**: Game-specific S3 operations
- **AWS SDK v3**: Modern AWS service integration

### Presentation Layer
- **Controllers**: HTTP request/response handling (EntityController, UserController, GameController)
- **Error Handling**: RFC 7807 compliant error responses
- **CORS**: Cross-origin resource sharing
- **Routing**: RESTful route management with middleware

## 🧪 Testing

### Automated Testing

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

### Manual Testing

```bash
# Run comprehensive Game API testing
./test-game-api.sh

# Quick testing commands
cat quick-test-commands.txt

# Use pre-formatted test data
cat test-data.json
```

### Test Structure

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end API testing
- **Mocking**: AWS SDK v3 service mocking
- **Manual Testing**: Comprehensive API testing scripts

## 📁 Project Structure

```
apiv2/
├── src/
│   ├── domain/                 # Domain entities and business logic
│   │   ├── entity/             # BaseEntity, JsonEntity, User, GameEntity, Round, Move
│   │   └── repository/         # Repository interfaces
│   ├── application/            # Application services and DTOs
│   │   ├── dto/               # Data transfer objects
│   │   └── services/          # Business logic services
│   ├── infrastructure/         # External service implementations
│   │   ├── http/              # API Gateway adapter
│   │   └── persistence/       # S3 repositories
│   ├── presentation/           # HTTP controllers and routing
│   │   ├── controllers/       # EntityController, UserController, GameController
│   │   ├── middleware/         # CORS, content-type, error handling
│   │   └── routing/           # Router implementation
│   ├── shared/                # Shared utilities
│   │   ├── errors/            # Custom error classes
│   │   ├── logging/           # Logger implementation
│   │   └── types/             # Common type definitions
│   └── index.ts               # Lambda entry point
├── test-game-api.sh           # Game API testing script
├── quick-test-commands.txt    # Quick testing commands
├── test-data.json            # Pre-formatted test data
├── TESTING_GUIDE.md          # Comprehensive testing guide
├── API_DOCUMENTATION.md      # Comprehensive API docs
├── API_REFERENCE.md          # Quick reference guide
├── COMPLETE_API_DOCUMENTATION.md  # Complete API documentation
├── COMPLETE_OPENAPI.yaml     # Complete OpenAPI specification
├── API_QUICK_REFERENCE.md   # Quick API reference
├── openapi.yaml              # OpenAPI specification
└── README.md                 # This file
```

## 🔧 Configuration

### Infrastructure Setup (Terraform - Recommended)

All infrastructure (S3, Lambda, API Gateway, CloudFront, Route53) is managed via Terraform:

```bash
cd ../terraform

# Initialize (first time only)
terraform init

# Deploy infrastructure
terraform apply

# View configuration
terraform show
```

See [`../terraform/README.md`](../terraform/README.md) for detailed infrastructure documentation.

### Manual Setup (Legacy)

```bash
# Create S3 bucket
aws s3 mb s3://data-1-088455116440

# Configure bucket policy
aws s3api put-bucket-policy \
  --bucket data-1-088455116440 \
  --policy file://bucket-policy.json
```

## 🚀 Deployment

### Infrastructure Management (Recommended)

**All infrastructure is now managed with Terraform** for reproducible deployments:

```bash
# Navigate to Terraform directory
cd ../terraform

# Deploy/update infrastructure
terraform apply

# Deploy Lambda code changes
cd ../apiv2
./buildAndDeploy.sh
```

See [`../terraform/README.md`](../terraform/README.md) for complete infrastructure documentation.

### Manual Deployment (Legacy)

```bash
# Build and package
npm run build

# Deploy Lambda function
./buildAndDeploy.sh

# Or use AWS CLI directly
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://lambda.zip
```

### CloudFront Cache Invalidation

```bash
# Invalidate cache after deployment
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/apiv2/*"
```

## 📊 Monitoring

### CloudWatch Logs

```bash
# View logs
aws logs tail /aws/lambda/vkp-api2-service --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/vkp-api2-service \
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

- **Documentation**: See `COMPLETE_API_DOCUMENTATION.md` for detailed API docs
- **Testing**: Use `test-game-api.sh` for comprehensive API testing
- **Quick Reference**: See `API_QUICK_REFERENCE.md` for quick endpoint lookup
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 🔄 Changelog

### v3.0.0
- Added comprehensive Game API with rounds, moves, and state management
- Implemented GameEntity with backing store pattern
- Added game-specific operations: add rounds, add moves, finish rounds/games
- Created comprehensive testing resources (test-game-api.sh, TESTING_GUIDE.md)
- Updated API documentation with complete Game API reference
- Enhanced project structure with new testing and documentation files

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