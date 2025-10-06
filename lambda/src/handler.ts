import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const allowOrigin = process.env.CORS_ORIGIN ?? "https://vkp-consulting.fr";

function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": allowOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method || "GET";

  // CORS preflight
  if (method === "OPTIONS") return json(204, {});

  if (method === "GET") {
    return json(200, { ok: true, message: "Hello from Lambda!", time: new Date().toISOString() });
  }

  if (method === "POST") {
    let data: unknown = {};
    try { data = event.body ? JSON.parse(event.body) : {}; } catch { data = { _raw: event.body }; }
    return json(200, { ok: true, received: data, path: event.rawPath });
  }

  return json(405, { error: "Method not allowed" });
}
