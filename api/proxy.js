// pirsch-relay — first-party proxy for Pirsch Analytics (Vercel Edge Function).
//
// Serves the Pirsch script and forwards page views, events and sessions from
// your own subdomain (e.g. a.example.com) to the Pirsch API. Blockers that
// filter api.pirsch.io never see a third-party request, so measurement is not
// silently suppressed. Pirsch itself is cookieless; this relay adds no cookies
// and stores nothing.
//
// Based on the protocol of the official Pirsch Cloudflare Worker
// (github.com/pirsch-analytics/demo) and verified against the pa.js that
// api.pirsch.io serves.
//
// All configuration comes from environment variables, see .env.example.
// The Pirsch access key never leaves the server.

import { eventsJS } from "../lib/events.js";

// Execution region. Pinned to Frankfurt (fra1) so requests — including the
// visitor IP that is passed on to Pirsch — are processed in the EU. Vercel
// requires this to be a static value, so it cannot come from an env var.
// Change it here if you want another region, and update your privacy policy.
export const config = { runtime: "edge", regions: ["fra1"] };

const DEFAULT_PIRSCH_BASE_URL = "https://api.pirsch.io";

function env(name) {
  const value = globalThis.process?.env?.[name];
  return typeof value === "string" ? value.trim() : "";
}

// Read configuration per request so a changed env var never needs a code edit.
function readConfig() {
  return {
    accessKey: env("PIRSCH_ACCESS_KEY"),
    baseURL: (env("PIRSCH_BASE_URL") || DEFAULT_PIRSCH_BASE_URL).replace(/\/+$/, ""),
    scriptPath: env("RELAY_SCRIPT_PATH"),
    hitPath: env("RELAY_HIT_PATH"),
    eventPath: env("RELAY_EVENT_PATH"),
    sessionPath: env("RELAY_SESSION_PATH"),
    eventsScriptPath: env("RELAY_EVENTS_SCRIPT_PATH"), // optional
    allowedOrigin: env("RELAY_ALLOWED_ORIGIN") || "*",
  };
}

// Returns a list of problems; empty means the relay is ready.
export function configProblems(cfg) {
  const problems = [];
  if (!cfg.accessKey) problems.push("PIRSCH_ACCESS_KEY is not set");
  const paths = {
    RELAY_SCRIPT_PATH: cfg.scriptPath,
    RELAY_HIT_PATH: cfg.hitPath,
    RELAY_EVENT_PATH: cfg.eventPath,
    RELAY_SESSION_PATH: cfg.sessionPath,
  };
  if (cfg.eventsScriptPath) paths.RELAY_EVENTS_SCRIPT_PATH = cfg.eventsScriptPath;
  const seen = new Map();
  for (const [name, value] of Object.entries(paths)) {
    if (!value) {
      problems.push(`${name} is not set`);
    } else if (!value.startsWith("/")) {
      problems.push(`${name} must start with "/"`);
    } else if (value === "/" || value === "/robots.txt") {
      problems.push(`${name} must not be "${value}"`);
    } else if (seen.has(value)) {
      problems.push(`${name} duplicates ${seen.get(value)}`);
    } else {
      seen.set(value, name);
    }
  }
  return problems;
}

// Real client IP on Vercel (x-real-ip is set by Vercel; fall back to XFF).
function clientIP(request) {
  return (
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    ""
  );
}

function withCORS(response, cfg) {
  const r = new Response(response.body, response);
  r.headers.set("Access-Control-Allow-Origin", cfg.allowedOrigin);
  r.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type");
  if (cfg.allowedOrigin !== "*") r.headers.append("Vary", "Origin");
  // Ask the browser for low-entropy client hints (browser/OS detection).
  r.headers.set(
    "Accept-CH",
    "Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version"
  );
  return r;
}

export default async function handler(request) {
  const cfg = readConfig();
  const path = new URL(request.url).pathname;

  if (request.method === "OPTIONS") {
    return withCORS(new Response(null, { status: 204 }), cfg);
  }

  // Keep crawlers off the relay; works even before configuration is complete.
  if (path === "/robots.txt") {
    return withCORS(
      new Response("User-agent: *\nDisallow: /\n", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
      cfg
    );
  }

  const problems = configProblems(cfg);
  if (problems.length) {
    // Details go to the function log, not to the public.
    console.error(`pirsch-relay is not configured: ${problems.join("; ")}`);
    return withCORS(new Response("relay not configured\n", { status: 500 }), cfg);
  }

  let result;
  try {
    if (path === cfg.scriptPath) {
      result = await getScript(cfg);
    } else if (path === cfg.hitPath) {
      result = await handlePageView(request, cfg);
    } else if (path === cfg.eventPath) {
      result = await handleEvent(request, cfg);
    } else if (path === cfg.sessionPath) {
      result = await handleSession(request, cfg);
    } else if (cfg.eventsScriptPath && path === cfg.eventsScriptPath) {
      result = new Response(eventsJS, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    } else {
      result = new Response(null, { status: 404 });
    }
  } catch (err) {
    console.error(`pirsch-relay upstream error on ${path}: ${err?.message || err}`);
    result = new Response(null, { status: 502 });
  }

  return withCORS(result, cfg);
}

// Serve pa.js first-party. Vercel's CDN caches it via Cache-Control.
async function getScript(cfg) {
  const upstream = await fetch(`${cfg.baseURL}/pa.js`);
  if (!upstream.ok) return new Response(null, { status: 502 });
  const r = new Response(upstream.body, { status: 200 });
  r.headers.set("Content-Type", "application/javascript; charset=utf-8");
  r.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return r;
}

// Low-entropy client hints only. High-entropy hints (e.g. viewport width) are
// deliberately not forwarded.
function clientHeaders(request) {
  return {
    ip: clientIP(request),
    user_agent: request.headers.get("User-Agent"),
    accept_language: request.headers.get("Accept-Language"),
    sec_ch_ua: request.headers.get("Sec-CH-UA"),
    sec_ch_ua_mobile: request.headers.get("Sec-CH-UA-Mobile"),
    sec_ch_ua_platform: request.headers.get("Sec-CH-UA-Platform"),
    sec_ch_ua_platform_version: request.headers.get("Sec-CH-UA-Platform-Version"),
  };
}

function toInt(value) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

async function postToPirsch(cfg, endpoint, body) {
  const response = await fetch(`${cfg.baseURL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  // Statuses like 204/304 must not carry a body.
  const noBody = [204, 205, 304].includes(response.status);
  return new Response(noBody ? null : response.body, { status: response.status });
}

// pa.js sends page views as
//   GET ?nc=…&code=…&url=…&t=…&ref=…&w=…&h=…[&tag_<key>=<value>…]
async function handlePageView(request, cfg) {
  const q = new URL(request.url).searchParams;
  const body = {
    url: q.get("url"),
    code: q.get("code"),
    ...clientHeaders(request),
    title: q.get("t"),
    referrer: q.get("ref"),
    screen_width: toInt(q.get("w")),
    screen_height: toInt(q.get("h")),
  };
  // data-tag-* attributes arrive as tag_<key>=<value>; the API wants an object.
  const tags = {};
  for (const [key, value] of q) {
    if (key.startsWith("tag_") && key.length > 4) tags[key.slice(4)] = value;
  }
  if (Object.keys(tags).length) body.tags = tags;
  return postToPirsch(cfg, "/api/v1/hit", body);
}

// pa.js sends events as a sendBeacon JSON POST; tags and meta are in the body.
async function handleEvent(request, cfg) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return new Response(null, { status: 400 });
  }
  Object.assign(data, clientHeaders(request));
  return postToPirsch(cfg, "/api/v1/event", data);
}

// pa.js extends sessions (data-enable-sessions) with POST ?nc=…&code=…&url=…
// Without "code" Pirsch cannot assign the session to a dashboard.
async function handleSession(request, cfg) {
  const q = new URL(request.url).searchParams;
  const { accept_language, ...headers } = clientHeaders(request);
  return postToPirsch(cfg, "/api/v1/session", {
    code: q.get("code"),
    url: q.get("url"),
    ...headers,
  });
}
