/**
 * Pre-Token-Generation Lambda Trigger
 * 
 * Purpose:
 * - Add custom claims to JWT tokens
 * - Include user role based on group membership
 * - Include display name
 * - Ensure proper authorization data in tokens
 */

import { PreTokenGenerationTriggerEvent, PreTokenGenerationTriggerHandler } from 'aws-lambda';

export const handler: PreTokenGenerationTriggerHandler = async (event: PreTokenGenerationTriggerEvent) => {
  console.log('Pre-token-generation trigger invoked:', JSON.stringify({
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource
  }, null, 2));

  try {
    // Get user's groups from the request
    const groups = event.request.groupConfiguration.groupsToOverride || [];
    console.log(`User ${event.userName} belongs to groups:`, groups);

    // Determine role based on group membership (first group has highest precedence)
    let role = 'guest'; // Default role
    
    if (groups.includes('admin')) {
      role = 'admin';
      console.log('User has admin role');
    } else if (groups.includes('user')) {
      role = 'user';
      console.log('User has user role');
    } else if (groups.includes('guest')) {
      role = 'guest';
      console.log('User has guest role');
    }

    // Get display name from user attributes
    const displayName = event.request.userAttributes['custom:display_name'] || 'Anonymous';
    const email = event.request.userAttributes.email || '';

    // Add custom claims to the ID token
    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: {
        role: role,
        display_name: displayName,
        email: email
      },
      claimsToSuppress: [],
      groupOverrideDetails: {
        groupsToOverride: groups
      }
    };

    console.log('Custom claims added:', {
      role,
      display_name: displayName,
      email: email ? '***' : '(none)',
      groups
    });

    return event;

  } catch (error) {
    console.error('Pre-token-generation trigger error:', error);
    
    // Return event even if there's an error
    // This ensures token generation continues
    return event;
  }
};

