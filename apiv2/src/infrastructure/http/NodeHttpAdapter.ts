import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpRequest, HttpResponse } from './HttpTypes.js';

/**
 * Adapter to convert Node.js HTTP messages to/from our HTTP abstractions
 */
export class NodeHttpAdapter {
  static async toRequest(req: IncomingMessage): Promise<HttpRequest> {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);

    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers[key.toLowerCase()] = value.join(', ');
      } else {
        headers[key.toLowerCase()] = value;
      }
    }

    const query: Record<string, string | undefined> = {};
    for (const [key, value] of url.searchParams.entries()) {
      query[key] = value;
    }

    const rawBody = await readBody(req);
    let body: unknown;
    if (rawBody.length > 0) {
      const contentType = headers['content-type']?.toLowerCase() || '';
      if (contentType.includes('application/json')) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      } else {
        body = rawBody;
      }
    }

    return {
      method: req.method || 'GET',
      path: url.pathname,
      headers,
      query,
      params: {},
      body,
      requestId: headers['x-request-id'] || randomUUID()
    };
  }

  static writeResponse(
    res: ServerResponse,
    response: HttpResponse,
    corsOrigin: string = process.env.CORS_ORIGIN || '*'
  ): void {
    const hasBody = response.body !== undefined && response.statusCode !== 204 && response.statusCode !== 304;
    const contentType = response.headers['content-type'] || (hasBody ? 'application/json' : undefined);

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

    let body: string | undefined;
    if (hasBody) {
      body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    }

    res.writeHead(response.statusCode, headers);
    res.end(body);
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
