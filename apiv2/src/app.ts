import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { log } from "./logging.js";
import { problem, HttpError } from "./errors.js";
import { nameSchema, createSchema, listQuerySchema } from "./validation.js";
import * as store from "./s3.js";
import type { JsonValue } from "./types.js";

const corsOrigin = process.env.CORS_ORIGIN ?? "https://vkp-consulting.fr";
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 1048576);

function res(
  status: number,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,if-match,if-none-match",
      ...extraHeaders
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  };
}

function parseJsonBody(event: APIGatewayProxyEventV2): JsonValue {
  if (!event.body) return {} as JsonValue;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new HttpError(413, "Payload Too Large", "Body exceeds allowed size");
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    throw new HttpError(400, "Bad Request", "Invalid JSON body");
  }
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const ctx = event.requestContext;
  const method = ctx.http.method;
  const path = event.rawPath;

  // CORS preflight
  if (method === "OPTIONS") return res(204);

  const t0 = Date.now();
  try {
    // GET /apiv2/files (list)
    if (method === "GET" && path === "/apiv2/files") {
      const q = listQuerySchema.parse(event.queryStringParameters ?? {});
      const out = await store.listJson(q);
      return res(200, out);
    }

    // POST /apiv2/files (create new)
    if (method === "POST" && path === "/apiv2/files") {
      const body = parseJsonBody(event);
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) throw new HttpError(400, "Bad Request", parsed.error.message);
      const name = parsed.data.name;
      const ifNoneMatch = event.headers?.["if-none-match"];
      try {
        const etag = await store.putJson(name, parsed.data.data, { ifNoneMatch });
        return res(201, { name, etag }, { Location: `/apiv2/files/${encodeURIComponent(name)}`, ETag: etag });
      } catch (e: any) {
        if (e.status === 409) return problem(409, "Conflict", "File already exists", event);
        if (e.status === 413) return problem(413, "Payload Too Large", e.message, event);
        throw e;
      }
    }

    // Routes with /apiv2/files/{name} and /apiv2/files/{name}/meta
    const nameParam = event.pathParameters?.["name"];

    // GET /apiv2/files/{name}/meta
    if (method === "GET" && nameParam && path.endsWith("/meta")) {
      try {
        const name = nameSchema.parse(nameParam);
        const meta = await store.headJson(name);
        return res(200, meta, { ETag: meta.etag ?? "" });
      } catch (e: any) {
        if (e.status === 404) return problem(404, "Not Found", "File not found", event);
        throw e;
      }
    }

    // GET /apiv2/files/{name}
    if (method === "GET" && nameParam && path.startsWith("/apiv2/files/")) {
      const name = nameSchema.parse(nameParam);
      const inm = event.headers?.["if-none-match"];
      try {
        const got = await store.getJson(name, { ifNoneMatch: inm });
        if (got.status === 304) return { statusCode: 304, headers: { ETag: got.etag ?? "" } };
        return res(200, got.body, { ETag: got.etag ?? "" });
      } catch (e: any) {
        if (e.status === 404) return problem(404, "Not Found", "File not found", event);
        throw e;
      }
    }

    // PUT /apiv2/files/{name}
    if (method === "PUT" && nameParam) {
      const name = nameSchema.parse(nameParam);
      const body = parseJsonBody(event);
      const ifMatch = event.headers?.["if-match"];
      try {
        const etag = await store.putJson(name, body, { ifMatch });
        return res(200, { name, etag }, { ETag: etag });
      } catch (e: any) {
        if (e.status === 412) return problem(412, "Precondition Failed", "ETag mismatch", event);
        if (e.status === 413) return problem(413, "Payload Too Large", e.message, event);
        throw e;
      }
    }

    // PATCH /apiv2/files/{name}
    if (method === "PATCH" && nameParam) {
      const name = nameSchema.parse(nameParam);
      const body = parseJsonBody(event);
      const ifMatch = event.headers?.["if-match"];
      if (!ifMatch) return problem(428, "Precondition Required", "PATCH requires If-Match", event);
      try {
        const etag = await store.putJson(name, body, { ifMatch, patch: true });
        return res(200, { name, etag }, { ETag: etag });
      } catch (e: any) {
        if (e.status === 412) return problem(412, "Precondition Failed", "ETag mismatch", event);
        if (e.status === 404) return problem(404, "Not Found", "File not found", event);
        if (e.status === 413) return problem(413, "Payload Too Large", e.message, event);
        throw e;
      }
    }

    // DELETE /apiv2/files/{name}
    if (method === "DELETE" && nameParam) {
      const name = nameSchema.parse(nameParam);
      const ifMatch = event.headers?.["if-match"];
      try {
        await store.deleteJson(name, { ifMatch });
        return res(204);
      } catch (e: any) {
        if (e.status === 412) return problem(412, "Precondition Failed", "ETag mismatch", event);
        if (e.status === 404) return problem(404, "Not Found", "File not found", event);
        throw e;
      }
    }

    return problem(404, "Not Found", "No matching route", event);
  } catch (e: any) {
    const status = e.status ?? 500;
    const title = e.title ?? "Internal Server Error";
    const detail = e.detail ?? e.message ?? String(e);
    log("error", { status, title, detail });
    return problem(status, title, detail, event);
  } finally {
    log("req", { method, path, ms: Date.now() - t0 });
  }
}
