import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import feedHandler from "../api/feed.js";

const rootDir = join(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = join(rootDir, "public");
const port = Number.parseInt(process.env.PORT || "5173", 10);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(handler, req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const response = {
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) {
      res.statusCode = code;
      return response;
    },
    json(payload) {
      res.end(JSON.stringify(payload));
    }
  };

  handler({
    ...req,
    query: Object.fromEntries(url.searchParams.entries())
  }, response);
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" && !pathname.includes(".")) {
      const body = await readFile(join(publicDir, "index.html"));
      res.writeHead(200, {
        "Content-Type": contentTypes[".html"]
      });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/feed") {
    sendJson(feedHandler, req, res);
    return;
  }

  await serveStatic(url.pathname, res);
});

server.listen(port, host, () => {
  console.log(`Focus Reels running at http://${host}:${port}`);
});
