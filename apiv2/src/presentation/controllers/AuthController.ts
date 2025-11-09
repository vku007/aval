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
  InitiateAuthCommand,
  AuthFlowType
} from '@aws-sdk/client-cognito-identity-provider';

export class AuthController {
  private cognito: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;

  constructor(
    private readonly logger: Logger
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

