import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HttpRequest } from './infrastructure/http/HttpTypes.js';
import { NodeHttpAdapter } from './infrastructure/http/NodeHttpAdapter.js';
import { config, createRouter, handleError, logger } from './app.js';

function corsOrigin(): string {
  return process.env.CORS_ORIGIN || config.cors.allowedOrigin || '*';
}

export function createLocalServer(): http.Server {
  const origin = corsOrigin();

  return http.createServer(async (req, res) => {
    let request: HttpRequest | undefined;
    const startTime = Date.now();

    try {
      request = await NodeHttpAdapter.toRequest(req);
      logger.setContext({ requestId: request.requestId });
      logger.info('Request received', {
        method: request.method,
        path: request.path,
        query: request.query
      });

      const router = createRouter();
      const response = await router.handle(request);
      NodeHttpAdapter.writeResponse(res, response, origin);

      logger.info('Request completed', {
        method: request.method,
        path: request.path,
        status: response.statusCode,
        duration_ms: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Request failed', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime
      });

      const fallback: HttpRequest = request ?? {
        method: req.method || 'GET',
        path: req.url || '/',
        headers: {},
        query: {},
        params: {},
        requestId: 'unknown'
      };
      const errorResponse = handleError(error as Error, fallback);
      NodeHttpAdapter.writeResponse(res, errorResponse, origin);
    } finally {
      logger.clearContext();
    }
  });
}

export function listenLocalServer(
  server: http.Server,
  port: number = Number(process.env.PORT || 3000)
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      logger.info('Local API listening', {
        port: actualPort,
        dataDir: process.env.DATA_DIR || '(unset — S3)',
        skipAuth: process.env.SKIP_AUTH === 'true',
        corsOrigin: corsOrigin()
      });
      resolve(actualPort);
    });
  });
}

function isExecutedAsMain(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isExecutedAsMain()) {
  const server = createLocalServer();
  await listenLocalServer(server);
}
