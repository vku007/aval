/**
 * Role-Based Authorization Middleware
 * 
 * Purpose:
 * - Check if user has required role
 * - Return 403 Forbidden if user doesn't have access
 */

import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/index.js';
import { AuthenticatedRequest } from './auth.js';

/**
 * Require specific role(s) to access endpoint
 * 
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns Middleware function
 * 
 * @example
 * // Only admins can access
 * .get('/admin/users', requireRole('admin'), handler)
 * 
 * @example
 * // Admins or regular users can access
 * .get('/api/data', requireRole('admin', 'user'), handler)
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authRequest = request as AuthenticatedRequest;

    // Check if user is authenticated
    if (!authRequest.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    // Check if user has one of the allowed roles
    const userRole = authRequest.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`
      );
    }

    // User has required role, continue
    return next();
  };
}

/**
 * Require user to be in specific group(s)
 * 
 * @param allowedGroups - Array of groups that are allowed to access the endpoint
 * @returns Middleware function
 */
export function requireGroup(...allowedGroups: string[]) {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    const userGroups = authRequest.user.groups;
    const hasRequiredGroup = allowedGroups.some(group => userGroups.includes(group));

    if (!hasRequiredGroup) {
      throw new ForbiddenError(
        `Access denied. Required group: ${allowedGroups.join(' or ')}`
      );
    }

    return next();
  };
}

/**
 * Require user to be authenticated (any role)
 */
export function requireAuth() {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      throw new UnauthorizedError('Authentication required');
    }

    return next();
  };
}

/**
 * Require user to own the resource
 * Checks if the user's sub matches the resource owner
 * 
 * @param getOwnerId - Function to extract owner ID from request
 */
export function requireOwnership(getOwnerId: (request: HttpRequest) => string) {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    const ownerId = getOwnerId(request);
    const userId = authRequest.user.sub;

    // Admins can access any resource
    if (authRequest.user.role === 'admin') {
      return next();
    }

    // Check ownership
    if (userId !== ownerId) {
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    return next();
  };
}

