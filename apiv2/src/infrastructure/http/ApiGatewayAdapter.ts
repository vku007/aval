import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { HttpRequest, HttpResponse } from './HttpTypes.js';

/**
 * Adapter to convert API Gateway events to/from our HTTP abstractions
 */
export class ApiGatewayAdapter {
  /**
   * Convert API Gateway event to framework-agnostic HTTP request
   */
  static toRequest(event: APIGatewayProxyEventV2): HttpRequest {
    // Normalize headers to lowercase
    const headers: Record<string, string | undefined> = {};
    if (event.headers) {
      for (const [key, value] of Object.entries(event.headers)) {
        headers[key.toLowerCase()] = value;
      }
    }

    // Extract query parameters
    const query: Record<string, string | undefined> = event.queryStringParameters || {};

    // Extract path parameters
    const params: Record<string, string> = {};
    if (event.pathParameters) {
      for (const [key, value] of Object.entries(event.pathParameters)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
    }

    // Parse body if present
    let body: unknown;
    if (event.body) {
      const contentType = headers['content-type']?.toLowerCase() || '';
      if (contentType.includes('application/json')) {
        try {
          body = event.isBase64Encoded
            ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf8'))
            : JSON.parse(event.body);
        } catch {
          body = event.body; // Fallback to raw body on parse error
        }
      } else {
        body = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
      }
    }

    return {
      method: event.requestContext.http.method,
      path: event.rawPath,
      headers,
      query,
      params,
      body,
      requestId: event.requestContext.requestId
    };
  }

  /**
   * Convert HTTP response to API Gateway response
   */
  static toApiGatewayResponse(
    response: HttpResponse,
    corsOrigin: string = process.env.CORS_ORIGIN || 'https://vkp-consulting.fr'
  ): APIGatewayProxyResultV2 {
    // Determine content type
    const hasBody = response.body !== undefined && response.statusCode !== 204 && response.statusCode !== 304;
    const contentType = response.headers['content-type'] || (hasBody ? 'application/json' : undefined);

    // Build headers with CORS
    const headers: Record<string, string> = {
      ...response.headers,
      'access-control-allow-origin': corsOrigin,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,if-match,if-none-match',
      'access-control-expose-headers': 'etag,location'
    };

    if (contentType) {
      headers['content-type'] = contentType;
    }

    // Serialize body
    let body: string | undefined;
    if (hasBody) {
      if (typeof response.body === 'string') {
        body = response.body;
      } else {
        body = JSON.stringify(response.body);
      }
    }

    return {
      statusCode: response.statusCode,
      headers,
      body
    };
  }
}

