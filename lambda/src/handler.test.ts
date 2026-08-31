import { describe, it, expect } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "./handler";

function baseEvent(method: string, overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} /api`,
    rawPath: "/api",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "example.execute-api.eu-north-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method,
        path: "/api",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "test",
      routeKey: `${method} /api`,
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("handler", () => {
  it("responds to OPTIONS with 204", async () => {
    const res = await handler(baseEvent("OPTIONS"));
    expect(res).toMatchObject({ statusCode: 204 });
  });

  it("responds to GET with hello payload", async () => {
    const res = await handler(baseEvent("GET"));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/Hello from Lambda/);
    expect(typeof body.time).toBe("string");
  });

  it("echos JSON on POST", async () => {
    const payload = { a: 1, b: "x" };
    const res = await handler(baseEvent("POST", { body: JSON.stringify(payload) }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.ok).toBe(true);
    expect(body.received).toEqual(payload);
  });

  it("returns 405 for unsupported method", async () => {
    const res = await handler(baseEvent("PUT"));
    expect(res.statusCode).toBe(405);
  });
});
