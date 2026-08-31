import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export class HttpError extends Error {
  status: number;
  title: string;
  type: string;
  detail?: string;
  constructor(status: number, title: string, detail?: string, type = "about:blank") {
    super(title);
    this.status = status;
    this.title = title;
    this.type = type;
    this.detail = detail;
  }
}

export const problem = (
  status: number,
  title: string,
  detail: string | undefined,
  event: APIGatewayProxyEventV2,
  corsOrigin = process.env.CORS_ORIGIN ?? "https://vkp-consulting.fr"
): APIGatewayProxyResultV2 => {
  const body = {
    type: "about:blank",
    title,
    status,
    detail,
    instance: event.rawPath
  };
  return {
    statusCode: status,
    headers: {
      "content-type": "application/problem+json",
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,if-match,if-none-match"
    },
    body: JSON.stringify(body)
  };
};
