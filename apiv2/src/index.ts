import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayAdapter } from './infrastructure/http/ApiGatewayAdapter.js';
import { config, createRouter, handleError, logger } from './app.js';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  logger.setContext({ requestId });

  try {
    const request = ApiGatewayAdapter.toRequest(event);

    logger.info('Request received', {
      method: request.method,
      path: request.path,
      query: request.query
    });

    const router = createRouter();
    const response = await router.handle(request);

    const apiGatewayResponse = ApiGatewayAdapter.toApiGatewayResponse(
      response,
      config.cors.allowedOrigin
    );

    logger.info('Request completed', {
      method: request.method,
      path: request.path,
      status: response.statusCode,
      duration_ms: Date.now() - startTime
    });

    return apiGatewayResponse;
  } catch (error) {
    logger.error('Request failed', {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startTime
    });

    const request = ApiGatewayAdapter.toRequest(event);
    const errorResponse = handleError(error as Error, request);

    return ApiGatewayAdapter.toApiGatewayResponse(
      errorResponse,
      config.cors.allowedOrigin
    );
  } finally {
    logger.clearContext();
  }
};
