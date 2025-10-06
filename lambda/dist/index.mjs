// src/handler.ts
var allowOrigin = process.env.CORS_ORIGIN ?? "https://vkp-consulting.fr";
function json(status, body) {
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
async function handler(event) {
  const method = event.requestContext?.http?.method || "GET";
  if (method === "OPTIONS") return json(204, {});
  if (method === "GET") {
    return json(200, { ok: true, message: "Hello from Lambda!", time: (/* @__PURE__ */ new Date()).toISOString() });
  }
  if (method === "POST") {
    let data = {};
    try {
      data = event.body ? JSON.parse(event.body) : {};
    } catch {
      data = { _raw: event.body };
    }
    return json(200, { ok: true, received: data, path: event.rawPath });
  }
  return json(405, { error: "Method not allowed" });
}
export {
  handler
};
