import { describe, it, expect } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "./handler";

function baseEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/",
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    resource: "/",
    requestContext: {} as any,
    multiValueHeaders: {},
    ...overrides
  } as APIGatewayProxyEvent;
}

describe("handler", () => {
  it("responds to OPTIONS with 204", async () => {
    const res = await handler(baseEvent({ httpMethod: "OPTIONS" }));
    expect(res.statusCode).toBe(204);
  });

  it("responds to GET with hello payload", async () => {
    const res = await handler(baseEvent({ httpMethod: "GET" }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/Hello from Lambda/);
    expect(typeof body.time).toBe("string");
  });

  it("echos JSON on POST", async () => {
    const payload = { a: 1, b: "x" };
    const res = await handler(baseEvent({ httpMethod: "POST", body: JSON.stringify(payload) }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.received).toEqual(payload);
  });

  it("returns 405 for unsupported method", async () => {
    const res = await handler(baseEvent({ httpMethod: "PUT" }));
    expect(res.statusCode).toBe(405);
  });
});


