import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    NotFound
  } from "@aws-sdk/client-s3";
  import type { JsonValue, ListResult, ListResultItem } from "./types.js";
  
  const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";
  const BUCKET = process.env.BUCKET_NAME!;
  const PREFIX = process.env.JSON_PREFIX ?? "json/";
  const APP_TAG = process.env.APP_TAG ?? "vkp-api";
  const ENV_TAG = process.env.ENVIRONMENT ?? "prod";
  const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 1048576); // 1MB
  
  export const s3 = new S3Client({ region: REGION });
  
  export function keyFor(name: string): string {
    return `${PREFIX}${encodeURIComponent(name)}.json`;
  }
  
  export async function listJson(params: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListResult> {
    const prefix = (params.prefix ?? "").trim();
    const limit = params.limit ?? 100;
    const token = params.cursor ? Buffer.from(params.cursor, "base64url").toString("utf8") : undefined;
  
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${PREFIX}${prefix}`,
        MaxKeys: limit,
        ContinuationToken: token
      })
    );
  
    const items: ListResultItem[] =
      out.Contents?.map((o) => {
        const raw = o.Key?.slice(PREFIX.length) ?? "";
        const decoded = raw.endsWith(".json") ? raw.slice(0, -5) : raw;
        return {
          name: decodeURIComponent(decoded),
          etag: o.ETag?.replaceAll('"', ""),
          size: o.Size,
          lastModified: o.LastModified?.toISOString()
        };
      }) ?? [];
  
    const nextCursor = out.IsTruncated && out.NextContinuationToken
      ? Buffer.from(out.NextContinuationToken, "utf8").toString("base64url")
      : undefined;
  
    return { items, nextCursor };
  }
  
  async function streamToString(stream: any): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  }
  
  export async function getJson(name: string, opts: { ifNoneMatch?: string } = {}) {
    const Key = keyFor(name);
    try {
      const resp = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key,
          IfNoneMatch: opts.ifNoneMatch
        })
      );
      if (!resp.Body) {
        return { status: 200, etag: resp.ETag?.replaceAll('"', ""), body: {} as JsonValue, lastModified: resp.LastModified?.toISOString() };
      }
      const text = await streamToString(resp.Body);
      const body = text ? (JSON.parse(text) as JsonValue) : {};
      return {
        status: 200,
        etag: resp.ETag?.replaceAll('"', ""),
        body,
        lastModified: resp.LastModified?.toISOString()
      };
    } catch (err: any) {
      // S3 returns 304 via exception path in SDK v3 when IfNoneMatch matched
      if (err.$metadata?.httpStatusCode === 304) {
        return { status: 304, etag: opts.ifNoneMatch, body: undefined, lastModified: undefined };
      }
      if (err instanceof NotFound || err.$metadata?.httpStatusCode === 404) {
        throw Object.assign(new Error("Not Found"), { status: 404 });
      }
      throw err;
    }
  }
  
  /**
   * NOTE: S3 PutObject DOES NOT support atomic If-Match on ETag.
   * We implement best-effort concurrency:
   *  - If ifMatch is provided, HEAD first and compare; if mismatch => 412.
   *  - If ifNoneMatch="*", HEAD first; if exists => 412 (or 409 for POST path).
   * Consider enabling S3 Versioning to improve conflict handling.
   */
  export async function putJson(
    name: string,
    data: JsonValue,
    opts: { ifMatch?: string; ifNoneMatch?: string; patch?: boolean } = {}
  ): Promise<string> {
    const Key = keyFor(name);
  
    // Size guard
    const payload = JSON.stringify(data);
    if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) {
      const e: any = new Error("Payload too large");
      e.status = 413;
      throw e;
    }
  
    // Concurrency checks
    let currentEtag: string | undefined;
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));
      currentEtag = head.ETag?.replaceAll('"', "");
    } catch (err: any) {
      if (!(err instanceof NotFound) && err.$metadata?.httpStatusCode !== 404) throw err;
    }
  
    if (opts.ifNoneMatch === "*" && currentEtag) {
      const e: any = new Error("Already exists");
      e.status = 409;
      throw e;
    }
    if (opts.ifMatch && (!currentEtag || opts.ifMatch.replaceAll('"', "") !== currentEtag)) {
      const e: any = new Error("Precondition Failed");
      e.status = 412;
      throw e;
    }
  
    // PATCH flow (read-merge-write)
    let bodyToWrite = payload;
    if (opts.patch) {
      const prev = currentEtag
        ? await (async () => {
            const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }));
            const text = await streamToString(got.Body as any);
            return text ? JSON.parse(text) : {};
          })()
        : {};
      const merged = deepMerge(prev, data);
      bodyToWrite = JSON.stringify(merged);
    }
  
    const resp = await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body: bodyToWrite,
        ContentType: "application/json",
        ServerSideEncryption: "AES256",
        Tagging: `app=${encodeURIComponent(APP_TAG)}&env=${encodeURIComponent(ENV_TAG)}`
      })
    );
    // PutObject does not return new ETag reliably for multipart; for small JSON it will.
    return (resp.ETag ?? currentEtag ?? "").replaceAll('"', "");
  }
  
  export async function deleteJson(name: string, opts: { ifMatch?: string } = {}) {
    const Key = keyFor(name);
  
    if (opts.ifMatch) {
      let currentEtag: string | undefined;
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));
        currentEtag = head.ETag?.replaceAll('"', "");
      } catch (err: any) {
        if (err instanceof NotFound || err.$metadata?.httpStatusCode === 404) {
          const e: any = new Error("Not Found");
          e.status = 404;
          throw e;
        }
        throw err;
      }
      if (opts.ifMatch.replaceAll('"', "") !== currentEtag) {
        const e: any = new Error("Precondition Failed");
        e.status = 412;
        throw e;
      }
    }
  
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
  }
  
  export async function headJson(name: string) {
    const Key = keyFor(name);
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));
      return {
        etag: head.ETag?.replaceAll('"', ""),
        size: head.ContentLength ?? 0,
        lastModified: head.LastModified?.toISOString()
      };
    } catch (err: any) {
      if (err instanceof NotFound || err.$metadata?.httpStatusCode === 404) {
        const e: any = new Error("Not Found");
        e.status = 404;
        throw e;
      }
      throw err;
    }
  }
  
  // simple deep merge for PATCH
  function isObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function deepMerge(a: any, b: any): any {
    if (Array.isArray(a) && Array.isArray(b)) return b; // replace arrays by default
    if (isObject(a) && isObject(b)) {
      const out: any = { ...a };
      for (const k of Object.keys(b)) out[k] = deepMerge((a as any)[k], (b as any)[k]);
      return out;
    }
    return b;
  }
  