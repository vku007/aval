import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "./app.js";
import * as store from "./s3.js";

// Mock S3 module
vi.mock("./s3.js", () => ({
  listJson: vi.fn(),
  getJson: vi.fn(),
  putJson: vi.fn(),
  deleteJson: vi.fn(),
  headJson: vi.fn()
}));

function mockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "ANY /apiv2/{proxy+}",
    rawPath: "/apiv2/files",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      domainName: "test.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method: "GET",
        path: "/apiv2/files",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest"
      },
      requestId: "test-request-id",
      routeKey: "ANY /apiv2/{proxy+}",
      stage: "$default",
      time: "01/Jan/2025:00:00:00 +0000",
      timeEpoch: 1704067200000
    },
    isBase64Encoded: false,
    ...overrides
  } as APIGatewayProxyEventV2;
}

describe("API Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CORS and Preflight", () => {
    it("should handle OPTIONS preflight", async () => {
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "OPTIONS" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(204);
    });

    it("should include CORS headers in error responses", async () => {
      const event = mockEvent({
        rawPath: "/apiv2/invalid",
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "GET", path: "/apiv2/invalid" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers?.["access-control-allow-origin"]).toBe("https://vkp-consulting.fr");
    });
  });

  describe("Content-Type Validation", () => {
    it("should reject POST without content-type application/json", async () => {
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ name: "test", data: {} })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(415);
      expect(JSON.parse(res.body!).title).toBe("Unsupported Media Type");
    });

    it("should reject PUT without content-type", async () => {
      const event = mockEvent({
        rawPath: "/apiv2/files/test",
        pathParameters: { name: "test" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PUT", path: "/apiv2/files/test" }
        },
        body: JSON.stringify({ key: "value" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(415);
    });

    it("should accept POST with valid content-type", async () => {
      vi.mocked(store.putJson).mockResolvedValue("etag123");
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "test", data: { key: "value" } })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(201);
    });
  });

  describe("GET /apiv2/files (list)", () => {
    it("should return list of files", async () => {
      vi.mocked(store.listJson).mockResolvedValue({
        items: [
          { name: "file1", etag: "etag1", size: 100, lastModified: "2025-01-01T00:00:00Z" },
          { name: "file2", etag: "etag2", size: 200, lastModified: "2025-01-02T00:00:00Z" }
        ],
        nextCursor: undefined
      });
      const event = mockEvent();
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body!);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].name).toBe("file1");
    });

    it("should handle pagination with cursor", async () => {
      vi.mocked(store.listJson).mockResolvedValue({
        items: [{ name: "file3", etag: "etag3", size: 300 }],
        nextCursor: "next-cursor"
      });
      const event = mockEvent({
        queryStringParameters: { cursor: "prev-cursor", limit: "10" }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body!);
      expect(body.nextCursor).toBe("next-cursor");
    });
  });

  describe("GET /apiv2/files/{name}", () => {
    it("should return file content with ETag", async () => {
      vi.mocked(store.getJson).mockResolvedValue({
        status: 200,
        etag: "etag123",
        body: { key: "value" },
        lastModified: "2025-01-01T00:00:00Z"
      });
      const event = mockEvent({
        rawPath: "/apiv2/files/test",
        pathParameters: { name: "test" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, path: "/apiv2/files/test" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(res.headers?.ETag).toBe("etag123");
      expect(JSON.parse(res.body!).key).toBe("value");
    });

    it("should return 304 with If-None-Match", async () => {
      vi.mocked(store.getJson).mockResolvedValue({
        status: 304,
        etag: "etag123",
        body: undefined,
        lastModified: undefined
      });
      const event = mockEvent({
        rawPath: "/apiv2/files/test",
        pathParameters: { name: "test" },
        headers: { "if-none-match": "etag123" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, path: "/apiv2/files/test" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(304);
      expect(res.headers?.ETag).toBe("etag123");
    });

    it("should return 404 for non-existent file", async () => {
      vi.mocked(store.getJson).mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/missing",
        pathParameters: { name: "missing" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, path: "/apiv2/files/missing" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /apiv2/files (create)", () => {
    it("should create new file", async () => {
      vi.mocked(store.putJson).mockResolvedValue("new-etag");
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "newfile", data: { foo: "bar" } })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(201);
      expect(res.headers?.Location).toContain("/apiv2/files/newfile");
      expect(res.headers?.ETag).toBe("new-etag");
      const body = JSON.parse(res.body!);
      expect(body.name).toBe("newfile");
      expect(body.etag).toBe("new-etag");
    });

    it("should return 409 if file already exists without If-None-Match", async () => {
      vi.mocked(store.putJson).mockRejectedValue(Object.assign(new Error("Conflict"), { status: 409 }));
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "existing", data: {} })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(409);
    });

    it("should reject invalid JSON body", async () => {
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "application/json" },
        body: "{ invalid json"
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /apiv2/files/{name}", () => {
    it("should create or replace file", async () => {
      vi.mocked(store.putJson).mockResolvedValue("put-etag");
      const event = mockEvent({
        rawPath: "/apiv2/files/myfile",
        pathParameters: { name: "myfile" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PUT", path: "/apiv2/files/myfile" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updated: "data" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(res.headers?.ETag).toBe("put-etag");
    });

    it("should return 412 if If-Match fails", async () => {
      vi.mocked(store.putJson).mockRejectedValue(Object.assign(new Error("Precondition Failed"), { status: 412 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/myfile",
        pathParameters: { name: "myfile" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PUT", path: "/apiv2/files/myfile" }
        },
        headers: { "content-type": "application/json", "if-match": "old-etag" },
        body: JSON.stringify({ data: "new" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(412);
    });
  });

  describe("PATCH /apiv2/files/{name}", () => {
    it("should require If-Match header", async () => {
      const event = mockEvent({
        rawPath: "/apiv2/files/myfile",
        pathParameters: { name: "myfile" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PATCH", path: "/apiv2/files/myfile" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partial: "update" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(428);
      expect(JSON.parse(res.body!).title).toBe("Precondition Required");
    });

    it("should merge update with If-Match", async () => {
      vi.mocked(store.putJson).mockResolvedValue("merged-etag");
      const event = mockEvent({
        rawPath: "/apiv2/files/myfile",
        pathParameters: { name: "myfile" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PATCH", path: "/apiv2/files/myfile" }
        },
        headers: { "content-type": "application/json", "if-match": "current-etag" },
        body: JSON.stringify({ newField: "value" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(vi.mocked(store.putJson)).toHaveBeenCalledWith(
        "myfile",
        { newField: "value" },
        { ifMatch: "current-etag", patch: true }
      );
    });

    it("should return 404 if file does not exist for PATCH", async () => {
      vi.mocked(store.putJson).mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/missing",
        pathParameters: { name: "missing" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "PATCH", path: "/apiv2/files/missing" }
        },
        headers: { "content-type": "application/json", "if-match": "any" },
        body: JSON.stringify({ data: "x" })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /apiv2/files/{name}", () => {
    it("should delete file and return 204", async () => {
      vi.mocked(store.deleteJson).mockResolvedValue(undefined);
      const event = mockEvent({
        rawPath: "/apiv2/files/deleteme",
        pathParameters: { name: "deleteme" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "DELETE", path: "/apiv2/files/deleteme" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(204);
    });

    it("should return 412 if If-Match fails on delete", async () => {
      vi.mocked(store.deleteJson).mockRejectedValue(Object.assign(new Error("Precondition Failed"), { status: 412 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/file",
        pathParameters: { name: "file" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "DELETE", path: "/apiv2/files/file" }
        },
        headers: { "if-match": "wrong-etag" }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(412);
    });

    it("should return 404 if file not found", async () => {
      vi.mocked(store.deleteJson).mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/missing",
        pathParameters: { name: "missing" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "DELETE", path: "/apiv2/files/missing" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /apiv2/files/{name}/meta", () => {
    it("should return file metadata", async () => {
      vi.mocked(store.headJson).mockResolvedValue({
        etag: "meta-etag",
        size: 512,
        lastModified: "2025-01-01T00:00:00Z"
      });
      const event = mockEvent({
        rawPath: "/apiv2/files/test/meta",
        pathParameters: { name: "test" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, path: "/apiv2/files/test/meta" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(res.headers?.ETag).toBe("meta-etag");
      const body = JSON.parse(res.body!);
      expect(body.size).toBe(512);
    });

    it("should return 404 for missing file metadata", async () => {
      vi.mocked(store.headJson).mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
      const event = mockEvent({
        rawPath: "/apiv2/files/missing/meta",
        pathParameters: { name: "missing" },
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, path: "/apiv2/files/missing/meta" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("405 Method Not Allowed", () => {
    it("should return 405 with Allow header for unsupported routes", async () => {
      const event = mockEvent({
        rawPath: "/apiv2/unknown",
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "GET", path: "/apiv2/unknown" }
        }
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers?.allow).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
      expect(res.headers?.["content-type"]).toBe("application/problem+json");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for unexpected errors", async () => {
      vi.mocked(store.listJson).mockRejectedValue(new Error("S3 service unavailable"));
      const event = mockEvent();
      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      expect(res.headers?.["content-type"]).toBe("application/problem+json");
    });

    it("should return 413 for payloads exceeding max size", async () => {
      vi.mocked(store.putJson).mockRejectedValue(Object.assign(new Error("Too large"), { status: 413 }));
      const event = mockEvent({
        requestContext: {
          ...mockEvent().requestContext,
          http: { ...mockEvent().requestContext.http, method: "POST" }
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "large", data: "x".repeat(2000000) })
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(413);
    });
  });
});
