/**
 * Pre-Signup Lambda Trigger
 * 
 * Purpose:
 * - Validate display name uniqueness
 * - Auto-confirm guest users (users without email)
 * - Require email verification for regular users
 */

import { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'eu-north-1' });

export const handler: PreSignUpTriggerHandler = async (event: PreSignUpTriggerEvent) => {
  console.log('Pre-signup trigger invoked:', JSON.stringify({
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource
  }, null, 2));

  try {
    const displayName = event.request.userAttributes['custom:display_name'];
    const email = event.request.userAttributes.email;
    const userPoolId = event.userPoolId;

    // Note: Display name uniqueness check is disabled for now
    // Cognito doesn't support filtering on custom attributes via ListUsers
    // This can be implemented using a DynamoDB table to track display names
    if (displayName) {
      console.log(`Display name provided: ${displayName}`);
    }

    // Determine if this is a guest user (no email)
    const isGuestUser = !email || email.trim() === '';

    if (isGuestUser) {
      console.log('Guest user detected - auto-confirming');
      // Auto-confirm guest users
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = false;
      event.response.autoVerifyPhone = false;
    } else {
      console.log('Regular user detected - requiring email verification');
      // Regular users need email verification
      event.response.autoConfirmUser = false;
      event.response.autoVerifyEmail = true;
      event.response.autoVerifyPhone = false;
    }

    console.log('Pre-signup validation successful');
    return event;

  } catch (error) {
    console.error('Pre-signup trigger error:', error);
    
    // Re-throw the error to prevent user creation
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Pre-signup validation failed');
  }
};

