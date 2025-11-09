/**
 * Authentication Middleware
 * 
 * Purpose:
 * - Verify JWT tokens from Authorization header
 * - Extract user information from token
 * - Attach user to request for downstream use
 */

import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { UnauthorizedError } from '../../shared/errors/index.js';

const USER_POOL_ID = process.env.USER_POOL_ID || '';
const REGION = process.env.REGION || process.env.AWS_REGION || 'eu-north-1';
const CLIENT_ID = process.env.CLIENT_ID || '';

// JWKS client for JWT verification
const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const client = jwksClient({ jwksUri });

/**
 * Get signing key from JWKS
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

/**
 * Extended request interface with user information
 */
export interface AuthenticatedRequest extends HttpRequest {
  user?: {
    userId: string;  // Primary user ID (from sub claim)
    sub: string;     // Cognito sub claim (same as userId)
    email?: string;
    role: string;
    display_name: string;
    groups: string[];
  };
}

/**
 * Verify JWT token
 */
async function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
        audience: CLIENT_ID,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

/**
 * Authentication middleware
 * Verifies JWT and attaches user info to request
 */
export function authMiddleware() {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    // Extract Authorization header
    const authHeader = request.headers.authorization || request.headers.Authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    try {
      // Verify JWT
      const decoded = await verifyToken(token);

      // Extract user information from token
      const authRequest = request as AuthenticatedRequest;
      authRequest.user = {
        userId: decoded.sub,  // Map 'sub' claim to 'userId'
        sub: decoded.sub,
        email: decoded.email || '',
        role: decoded['custom:role'] || decoded.role || 'guest',  // Check custom:role first
        display_name: decoded['custom:display_name'] || decoded.display_name || 'Anonymous',
        groups: decoded['cognito:groups'] || [],
      };

      // Continue to next middleware/handler
      return next();

    } catch (error) {
      if (error instanceof Error) {
        throw new UnauthorizedError(`Invalid or expired token: ${error.message}`);
      }
      throw new UnauthorizedError('Invalid or expired token');
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export function optionalAuthMiddleware() {
  return async (request: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    const authHeader = request.headers.authorization || request.headers.Authorization;

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');

      try {
        const decoded = await verifyToken(token);
        const authRequest = request as AuthenticatedRequest;
        authRequest.user = {
          userId: decoded.sub,  // Map 'sub' claim to 'userId'
          sub: decoded.sub,
          email: decoded.email || '',
          role: decoded['custom:role'] || decoded.role || 'guest',  // Check custom:role first
          display_name: decoded['custom:display_name'] || decoded.display_name || 'Anonymous',
          groups: decoded['cognito:groups'] || [],
        };
      } catch (error) {
        // Ignore errors for optional auth
        console.warn('Optional auth failed:', error);
      }
    }

    return next();
  };
}

