import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { pipeline } from "node:stream";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const distDir = resolve(process.env.DIST_DIR ?? "dist");
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
const apiPrefixes = ["/machines", "/sessions", "/command", "/commands", "/assess"];

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function isApiPath(pathname) {
  return apiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function safeStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname.split("?")[0]);
  const normalizedPath = normalize(decodedPath).replace(/^([.][.][/\\])+/, "");
  const relativePath = normalizedPath === "/" ? "index.html" : normalizedPath.replace(/^[/\\]/, "");
  const filePath = resolve(join(distDir, relativePath));
  return filePath.startsWith(distDir) ? filePath : null;
}

async function proxyRequest(req, res, originalUrl) {
  const targetUrl = new URL(originalUrl, apiProxyTarget);
  const headers = new Headers(req.headers);
  headers.set("host", targetUrl.host);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : req,
      duplex: "half",
    });

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (!response.body) {
      res.end();
      return;
    }
    pipeline(response.body, res, (error) => {
      if (error && !res.destroyed) {
        res.destroy(error);
      }
    });
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({ error: "api_proxy_failed", message: error instanceof Error ? error.message : String(error) }),
      { "content-type": "application/json; charset=utf-8" },
    );
  }
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (isApiPath(requestUrl.pathname)) {
    void proxyRequest(req, res, requestUrl.pathname + requestUrl.search);
    return;
  }

  const staticPath = safeStaticPath(requestUrl.pathname);
  const filePath = staticPath && existsSync(staticPath) && statSync(staticPath).isFile()
    ? staticPath
    : join(distDir, "index.html");

  const contentType = mimeTypes.get(extname(filePath)) ?? "application/octet-stream";
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Dashboard server listening on http://${host}:${port}`);
  console.log(`Proxying API requests to ${apiProxyTarget}`);
});
