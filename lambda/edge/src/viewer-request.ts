/**
 * Lambda@Edge Viewer Request Function
 * 
 * Purpose:
 * - Check for JWT token in cookies
 * - Validate JWT signature and expiration
 * - Redirect unauthenticated users to Cognito login
 * - Allow authenticated users to proceed
 * 
 * Note: This runs at CloudFront edge locations
 */

import { CloudFrontRequestEvent, CloudFrontRequestResult, CloudFrontRequestHandler } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

// Environment variables (set by Terraform)
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || 'vkp-auth.auth.eu-north-1.amazoncognito.com';
const USER_POOL_ID = process.env.USER_POOL_ID || '';
const REGION = process.env.AWS_REGION || 'eu-north-1';
const CLIENT_ID = process.env.CLIENT_ID || '';

// JWKS client for JWT verification
const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const client = jwksClient.jwksClient({ jwksUri });

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
 * Extract token from cookie string
 */
function extractTokenFromCookies(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const idTokenCookie = cookies.find(c => c.startsWith('idToken='));
  
  if (!idTokenCookie) return null;
  
  const token = idTokenCookie.split('=')[1];
  return token || null;
}

/**
 * Verify JWT token
 */
async function verifyToken(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
        audience: CLIENT_ID,
      },
      (err, decoded) => {
        if (err) {
          console.error('JWT verification failed:', err.message);
          resolve(false);
        } else {
          console.log('JWT verified successfully:', { sub: (decoded as any)?.sub });
          resolve(true);
        }
      }
    );
  });
}

/**
 * Create redirect response to Cognito login
 */
function createLoginRedirect(originalUri: string): CloudFrontRequestResult {
  const loginUrl = `https://${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+profile&redirect_uri=https://vkp-consulting.fr/callback&state=${encodeURIComponent(originalUri)}`;
  
  return {
    status: '302',
    statusDescription: 'Found',
    headers: {
      location: [{
        key: 'Location',
        value: loginUrl,
      }],
      'cache-control': [{
        key: 'Cache-Control',
        value: 'no-cache, no-store, must-revalidate',
      }],
    },
  };
}

/**
 * Main handler
 */
export const handler: CloudFrontRequestHandler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;
  const uri = request.uri;

  console.log('Viewer request:', { uri, method: request.method });

  // Public paths that don't require authentication
  const publicPaths = [
    '/callback',
    '/logout',
    '/errors/',
    '/favicon.ico',
    '/.well-known/',
  ];

  const isPublicPath = publicPaths.some(path => uri.startsWith(path));

  if (isPublicPath) {
    console.log('Public path, allowing request');
    return request;
  }

  // Extract JWT from cookie
  const cookieHeader = headers.cookie?.[0]?.value || '';
  const token = extractTokenFromCookies(cookieHeader);

  // No token - redirect to login
  if (!token) {
    console.log('No token found, redirecting to login');
    return createLoginRedirect(uri);
  }

  // Verify JWT
  const isValid = await verifyToken(token);

  if (!isValid) {
    console.log('Invalid token, redirecting to login');
    return createLoginRedirect(uri);
  }

  // Token is valid, allow request
  console.log('Token valid, allowing request');
  return request;
};

