// Run the relay locally with plain Node (>= 18), no Vercel account needed:
//
//   cp .env.example .env   # fill in the values
//   npm run local          # http://localhost:3000
//
// Reads .env from the repository root (simple KEY=VALUE lines). Variables that
// are already set in the shell take precedence. PORT changes the port.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadDotEnv(file = join(root, ".env")) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

// Wrap the edge handler (Request → Response) in a Node HTTP server.
export function createRelayServer(handler) {
  return createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      if (!headers.has("x-real-ip")) headers.set("x-real-ip", req.socket.remoteAddress || "");
      const request = new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) || !chunks.length ? undefined : Buffer.concat(chunks),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500).end();
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadDotEnv();
  const { default: handler } = await import("../api/proxy.js");
  const port = Number(process.env.PORT || 3000);
  createRelayServer(handler).listen(port, () => {
    console.log(`pirsch-relay listening on http://localhost:${port}`);
  });
}
