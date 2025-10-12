# User Manager

A web-based interface for managing User entities via the VKP API.

## Features

### 🔍 Browse Users
- View all users in a grid layout
- Filter users by prefix
- See user details including name, ID, external ID, and last modified date
- Real-time search with debounced input

### ➕ Create Users
- Create new users with validation
- Required fields: ID, Name, External ID
- ID validation: alphanumeric characters, dots, hyphens, underscores (1-128 chars)
- Name validation: 2-100 characters
- External ID validation: positive integer

### ✏️ Edit Users
- Update existing users with full or partial updates
- Support for both PUT (replace) and PATCH (merge) operations
- ETag-based concurrency control
- Delete users with confirmation

### 👁️ View Users
- Detailed user information display
- Shows metadata including size, last modified, and ETag
- Formatted display with emojis for better readability

## API Integration

The User Manager integrates with the following VKP API endpoints:

- `GET /apiv2/users` - List users with pagination
- `GET /apiv2/users/{id}` - Get user by ID
- `GET /apiv2/users/{id}/meta` - Get user metadata
- `POST /apiv2/users` - Create new user
- `PUT /apiv2/users/{id}` - Replace user (full update)
- `PATCH /apiv2/users/{id}` - Merge user (partial update)
- `DELETE /apiv2/users/{id}` - Delete user

## User Entity Structure

```json
{
  "id": "user-123",
  "name": "John Doe",
  "externalId": 1001
}
```

## Features

- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Automatic refresh after operations
- **Error Handling**: Comprehensive error messages and validation
- **Security**: XSS protection with HTML escaping
- **User Experience**: Loading states, confirmations, and intuitive navigation

## Usage

1. Open the User Manager in your browser
2. Use the Browse tab to view existing users
3. Use the Create tab to add new users
4. Click on users in the Browse tab to select them
5. Use the Edit tab to modify or delete selected users
6. Use the View button to see detailed user information

## Navigation

- **Back to Entity Manager**: Return to the main Entity Manager
- **Home**: Go back to the main API Management page

## Technical Details

- Built with vanilla HTML, CSS, and JavaScript
- Uses modern ES6+ features
- Responsive grid layout with CSS Grid
- RESTful API integration with proper error handling
- ETag-based concurrency control for safe updates
