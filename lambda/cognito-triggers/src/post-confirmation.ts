/**
 * Post-Confirmation Lambda Trigger
 * 
 * Purpose:
 * - Assign default group based on user type
 * - Guest users (no email) → guest group
 * - Regular users → user group
 * - Admins must be manually assigned to admin group
 */

import { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION || 'eu-north-1' });

export const handler: PostConfirmationTriggerHandler = async (event: PostConfirmationTriggerEvent) => {
  console.log('Post-confirmation trigger invoked:', JSON.stringify({
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource
  }, null, 2));

  try {
    const userPoolId = event.userPoolId;
    const username = event.userName;
    const email = event.request.userAttributes.email;

    // Determine default group based on user type
    let groupName = 'user'; // Default to regular user

    // Guest users (no email)
    if (!email || email.trim() === '') {
      groupName = 'guest';
      console.log(`Assigning user ${username} to guest group`);
    } else {
      console.log(`Assigning user ${username} to user group`);
    }

    // Add user to the appropriate group
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: groupName
    });

    await cognito.send(command);

    console.log(`Successfully added user ${username} to group ${groupName}`);
    return event;

  } catch (error) {
    console.error('Post-confirmation trigger error:', error);
    
    // Don't throw error here - user is already confirmed
    // Just log the error and return the event
    // The user can be manually added to a group later if needed
    return event;
  }
};

