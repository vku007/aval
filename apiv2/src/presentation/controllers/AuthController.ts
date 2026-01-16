/**
 * Authentication Controller
 * 
 * Handles authentication-related operations including guest user creation
 */

import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { ApplicationError } from '../../shared/errors/index.js';
import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  InitiateAuthCommand,
  AuthFlowType
} from '@aws-sdk/client-cognito-identity-provider';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserService } from '../../application/services/UserService.js';
import { UpdateUserDto } from '../../application/dto/UpdateUserDto.js';

export class AuthController {
  private cognito: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;

  constructor(
    private readonly logger: Logger,
    private readonly userService: UserService
  ) {
    this.cognito = new CognitoIdentityProviderClient({ 
      region: process.env.REGION || process.env.AWS_REGION || 'eu-north-1' 
    });
    this.userPoolId = process.env.USER_POOL_ID || '';
    this.clientId = process.env.CLIENT_ID || '';
  }

  /**
   * Create a guest user with dummy email
   */
  async createGuestUser(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      this.logger.info('Creating guest user');

      // Generate unique guest credentials
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 11);
      const guestEmail = `guest-${timestamp}-${randomId}@vkp.local`;
      const password = this.generateSecurePassword();

      this.logger.info('Generated guest credentials', { guestEmail });

      // Create Cognito user
      await this.cognito.send(new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: guestEmail,
        UserAttributes: [
          { Name: 'email', Value: guestEmail },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:display_name', Value: 'Guest User' },
        ],
        TemporaryPassword: password,
        MessageAction: 'SUPPRESS', // Don't send email (it's a dummy email)
      }));

      this.logger.info('Guest user created in Cognito', { guestEmail });

      // Set permanent password
      await this.cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: guestEmail,
        Password: password,
        Permanent: true,
      }));

      this.logger.info('Guest password set to permanent');

      // Add to guest group
      await this.cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: guestEmail,
        GroupName: 'guest',
      }));

      this.logger.info('Guest user added to guest group');

      // Authenticate and get tokens
      const authResponse = await this.cognito.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: guestEmail,
          PASSWORD: password,
        },
      }));

      if (!authResponse.AuthenticationResult) {
        throw new ApplicationError(500, 'Failed to authenticate guest user');
      }

      this.logger.info('Guest user authenticated successfully');

      return HttpResponse.ok({
        message: 'Guest user created successfully',
        guestEmail,
        tokens: {
          idToken: authResponse.AuthenticationResult.IdToken,
          accessToken: authResponse.AuthenticationResult.AccessToken,
          refreshToken: authResponse.AuthenticationResult.RefreshToken,
          expiresIn: authResponse.AuthenticationResult.ExpiresIn,
        },
      });

    } catch (error: any) {
      this.logger.error('Failed to create guest user', { 
        error: error.message, 
        code: error.code 
      });
      
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new ApplicationError(
        500, 
        `Failed to create guest user: ${error.message}`,
        'GUEST_CREATION_FAILED'
      );
    }
  }

  /**
   * Login with email and password
   */
  async login(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      this.logger.info('User login attempt');

      // Parse request body
      const body = request.body as { email?: string; password?: string };
      
      if (!body?.email || !body?.password) {
        throw new ApplicationError(400, 'Email and password are required');
      }

      const { email, password } = body;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ApplicationError(400, 'Invalid email format');
      }

      this.logger.info('Attempting authentication', { email });

      // Authenticate with Cognito
      const authResponse = await this.cognito.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }));

      if (!authResponse.AuthenticationResult) {
        throw new ApplicationError(500, 'Authentication failed');
      }

      this.logger.info('User authenticated successfully', { email });

      return HttpResponse.ok({
        message: 'Login successful',
        tokens: {
          idToken: authResponse.AuthenticationResult.IdToken,
          accessToken: authResponse.AuthenticationResult.AccessToken,
          refreshToken: authResponse.AuthenticationResult.RefreshToken,
          expiresIn: authResponse.AuthenticationResult.ExpiresIn,
        },
      });

    } catch (error: any) {
      this.logger.error('Login failed', { 
        error: error.message, 
        code: error.code 
      });
      
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Handle specific Cognito errors
      if (error.name === 'NotAuthorizedException') {
        throw new ApplicationError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }
      
      if (error.name === 'UserNotFoundException') {
        throw new ApplicationError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }
      
      if (error.name === 'TooManyRequestsException') {
        throw new ApplicationError(429, 'Too many login attempts. Please try again later.', 'RATE_LIMIT');
      }
      
      if (error.name === 'UserNotConfirmedException') {
        throw new ApplicationError(403, 'Email not verified. Please check your email.', 'EMAIL_NOT_VERIFIED');
      }
      
      throw new ApplicationError(
        500, 
        'Login failed. Please try again.',
        'LOGIN_FAILED'
      );
    }
  }

  /**
   * Promote guest user to regular user
   * Requires authentication - user must be logged in as guest
   */
  async promoteGuestToRegular(request: HttpRequest): Promise<{ statusCode: number; body?: unknown; headers: Record<string, string> }> {
    try {
      // Get authenticated user from JWT
      const authRequest = request as AuthenticatedRequest;
      const userId = authRequest.user?.userId;
      const currentEmail = authRequest.user?.email;
      const currentGroups = authRequest.user?.groups || [];
      
      if (!userId || !currentEmail) {
        throw new ApplicationError(401, 'User not authenticated');
      }
      
      this.logger.info('Promotion attempt', { userId, currentEmail, groups: currentGroups });

      // Validate user is actually a guest
      const isGuest = currentEmail.includes('@vkp.local') || currentGroups.includes('guest');
      if (!isGuest) {
        throw new ApplicationError(400, 'User is already a regular user', 'ALREADY_REGULAR');
      }

      // Parse and validate request body
      const body = request.body as { email?: string; password?: string; displayName?: string };
      
      if (!body?.email || !body?.password) {
        throw new ApplicationError(400, 'Email and password are required');
      }

      const { email, password, displayName } = body;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ApplicationError(400, 'Invalid email format');
      }

      // Prevent using dummy email domains
      if (email.includes('@vkp.local') || email.includes('@example.com') || email.includes('@test.com')) {
        throw new ApplicationError(400, 'Please use a valid email address');
      }

      // Validate password strength (must match Cognito policy: 12 chars minimum)
      if (password.length < 12) {
        throw new ApplicationError(400, 'Password must be at least 12 characters');
      }

      if (password.length > 256) {
        throw new ApplicationError(400, 'Password is too long (max 256 characters)');
      }

      // Check password complexity (at least one letter and one number)
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        throw new ApplicationError(400, 'Password must contain at least one letter and one number');
      }

      // Validate display name if provided
      const finalDisplayName = displayName || email.split('@')[0];
      if (finalDisplayName.length < 2 || finalDisplayName.length > 100) {
        throw new ApplicationError(400, 'Display name must be between 2 and 100 characters');
      }

      this.logger.info('Validation passed', { userId, newEmail: email });

      // Check if email is already in use by another user
      try {
        const listUsersResponse = await this.cognito.send(new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Filter: `email = "${email}"`
        }));

        if (listUsersResponse.Users && listUsersResponse.Users.length > 0) {
          // Check if it's the same user (shouldn't happen, but edge case)
          const existingUser = listUsersResponse.Users[0];
          const existingUserId = existingUser.Attributes?.find(attr => attr.Name === 'sub')?.Value;
          
          if (existingUserId !== userId) {
            this.logger.warn('Email already in use', { userId, email, existingUserId });
            throw new ApplicationError(409, 'Email address is already in use', 'EMAIL_EXISTS');
          }
        }
      } catch (error: any) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        this.logger.error('Error checking email availability', { error: error.message });
        // Continue anyway - will fail later if email truly exists
      }

      // Get current user from Cognito to verify they exist
      try {
        await this.cognito.send(new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: currentEmail
        }));
        this.logger.info('Current user verified', { userId, username: currentEmail });
      } catch (error: any) {
        if (error.name === 'UserNotFoundException') {
          throw new ApplicationError(404, 'User not found in authentication system', 'USER_NOT_FOUND');
        }
        throw error;
      }

      // IMPORTANT: Update password BEFORE updating email
      // This is because if email is used as username alias, updating email might change the username
      try {
        await this.cognito.send(new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: currentEmail,
          Password: password,
          Permanent: true
        }));
        this.logger.info('Updated user password', { userId });
      } catch (error: any) {
        this.logger.error('Failed to update password', { 
          userId, 
          username: currentEmail,
          error: error.message,
          errorName: error.name 
        });
        throw error;
      }

      // Update user attributes (email and display name)
      await this.cognito.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: currentEmail,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:display_name', Value: finalDisplayName }
        ]
      }));

      this.logger.info('Updated user email and attributes', { userId, newEmail: email });

      // Remove from guest group
      if (currentGroups.includes('guest')) {
        try {
          await this.cognito.send(new AdminRemoveUserFromGroupCommand({
            UserPoolId: this.userPoolId,
            Username: currentEmail,
            GroupName: 'guest'
          }));
          this.logger.info('Removed user from guest group', { userId });
        } catch (error: any) {
          this.logger.warn('Could not remove from guest group', { userId, error: error.message });
          // Not critical - continue
        }
      }

      // Add to regular user group (if it exists)
      try {
        await this.cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: this.userPoolId,
          Username: currentEmail,
          GroupName: 'user'
        }));
        this.logger.info('Added user to user group', { userId });
      } catch (error: any) {
        this.logger.warn('Could not add to user group', { userId, error: error.message });
        // Not critical - group might not exist
      }

      // Authenticate with new credentials to get new tokens
      let authResponse;
      try {
        authResponse = await this.cognito.send(new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: email, // Use new email
            PASSWORD: password
          }
        }));
      } catch (error: any) {
        this.logger.error('Failed to authenticate after promotion', { userId, error: error.message });
        throw new ApplicationError(500, 'User promoted but authentication failed. Please login with your new credentials.', 'AUTH_AFTER_PROMOTION_FAILED');
      }

      if (!authResponse.AuthenticationResult) {
        throw new ApplicationError(500, 'Failed to get authentication tokens after promotion');
      }

      this.logger.info('User promoted successfully', { userId, newEmail: email });

      // Update the User entity in S3 with the new display name
      try {
        const updateDto = new UpdateUserDto({ name: finalDisplayName }, true); // merge mode
        await this.userService.updateUser(userId, updateDto);
        this.logger.info('Updated user entity name', { userId, newName: finalDisplayName });
      } catch (error: any) {
        this.logger.warn('Could not update user entity name', { userId, error: error.message });
        // Not critical - user can still login, name just won't be updated immediately
      }

      return HttpResponse.ok({
        message: 'Registration successful! You are now a regular user.',
        email,
        displayName: finalDisplayName,
        tokens: {
          idToken: authResponse.AuthenticationResult.IdToken,
          accessToken: authResponse.AuthenticationResult.AccessToken,
          refreshToken: authResponse.AuthenticationResult.RefreshToken,
          expiresIn: authResponse.AuthenticationResult.ExpiresIn
        }
      });

    } catch (error: any) {
      this.logger.error('Failed to promote guest user', { 
        error: error.message, 
        code: error.code,
        name: error.name
      });
      
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Handle specific Cognito errors
      if (error.name === 'UserNotFoundException') {
        throw new ApplicationError(404, 'User not found', 'USER_NOT_FOUND');
      }
      
      if (error.name === 'UsernameExistsException' || error.name === 'AliasExistsException') {
        throw new ApplicationError(409, 'Email address is already in use', 'EMAIL_EXISTS');
      }
      
      if (error.name === 'InvalidPasswordException') {
        throw new ApplicationError(400, 'Password does not meet requirements', 'INVALID_PASSWORD');
      }
      
      if (error.name === 'InvalidParameterException') {
        throw new ApplicationError(400, 'Invalid email or password format', 'INVALID_PARAMETER');
      }
      
      if (error.name === 'TooManyRequestsException') {
        throw new ApplicationError(429, 'Too many requests. Please try again later.', 'RATE_LIMIT');
      }
      
      throw new ApplicationError(
        500, 
        'Registration failed. Please try again.',
        'PROMOTION_FAILED'
      );
    }
  }

  /**
   * Generate a secure random password
   */
  private generateSecurePassword(): string {
    const length = 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }
}

