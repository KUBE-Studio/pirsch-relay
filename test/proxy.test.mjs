// End-to-end test against a local mock of the Pirsch API — never the real one.
// Run with: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRelayServer } from "../scripts/local.mjs";
import handler from "../api/proxy.js";

const received = [];
let upstream;
let relay;
let relayURL;

const ENV = {
  PIRSCH_ACCESS_KEY: "test-key-not-real",
  RELAY_SCRIPT_PATH: "/static/t1/app.js",
  RELAY_HIT_PATH: "/t1/a",
  RELAY_EVENT_PATH: "/t1/b",
  RELAY_SESSION_PATH: "/t1/c",
  RELAY_EVENTS_SCRIPT_PATH: "/static/t1/e.js",
};

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

before(async () => {
  upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString("utf8");
    received.push({
      method: req.method,
      url: req.url,
      auth: req.headers.authorization,
      body: text ? JSON.parse(text) : null,
    });
    if (req.url === "/pa.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" }).end("/* mock pa.js */");
    } else {
      res.writeHead(200).end();
    }
  });
  const upstreamPort = await listen(upstream);
  Object.assign(process.env, ENV, { PIRSCH_BASE_URL: `http://127.0.0.1:${upstreamPort}` });
  relay = createRelayServer(handler);
  relayURL = `http://127.0.0.1:${await listen(relay)}`;
});

after(() => {
  upstream.close();
  relay.close();
});

const browserHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Accept-Language": "de-DE,de;q=0.9",
  "X-Forwarded-For": "203.0.113.7, 10.0.0.1",
  "X-Real-IP": "203.0.113.7",
};

test("serves pa.js first-party", async () => {
  const r = await fetch(`${relayURL}${ENV.RELAY_SCRIPT_PATH}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/javascript/);
  assert.equal(await r.text(), "/* mock pa.js */");
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});

test("forwards a page view with tags and the visitor IP", async () => {
  received.length = 0;
  const q = new URLSearchParams({
    nc: "1", code: "TESTCODE", url: "https://www.example.com/pricing?x=1",
    t: "Pricing", ref: "https://search.example/", w: "", h: "",
    tag_lang: "de",
  });
  const r = await fetch(`${relayURL}${ENV.RELAY_HIT_PATH}?${q}`, { headers: browserHeaders });
  assert.equal(r.status, 200);
  assert.equal(received.length, 1);
  const hit = received[0];
  assert.equal(hit.method, "POST");
  assert.equal(hit.url, "/api/v1/hit");
  assert.equal(hit.auth, "Bearer test-key-not-real");
  assert.equal(hit.body.code, "TESTCODE");
  assert.equal(hit.body.url, "https://www.example.com/pricing?x=1");
  assert.equal(hit.body.title, "Pricing");
  assert.equal(hit.body.referrer, "https://search.example/");
  assert.equal(hit.body.ip, "203.0.113.7");
  assert.equal(hit.body.user_agent, browserHeaders["User-Agent"]);
  assert.equal(hit.body.accept_language, "de-DE,de;q=0.9");
  assert.equal(hit.body.screen_width, 0);
  assert.deepEqual(hit.body.tags, { lang: "de" });
});

test("forwards an event with meta", async () => {
  received.length = 0;
  const beacon = {
    identification_code: "TESTCODE",
    url: "https://www.example.com/contact",
    title: "Contact",
    referrer: "",
    screen_width: 0,
    screen_height: 0,
    tags: {},
    event_name: "contact_submit",
    event_duration: 0,
    event_meta: { form: "contact" },
    non_interactive: false,
    ip: "198.51.100.1", // must be overwritten by the relay
  };
  const r = await fetch(`${relayURL}${ENV.RELAY_EVENT_PATH}`, {
    method: "POST",
    headers: { ...browserHeaders, "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(beacon),
  });
  assert.equal(r.status, 200);
  assert.equal(received.length, 1);
  const ev = received[0];
  assert.equal(ev.url, "/api/v1/event");
  assert.equal(ev.auth, "Bearer test-key-not-real");
  assert.equal(ev.body.event_name, "contact_submit");
  assert.deepEqual(ev.body.event_meta, { form: "contact" });
  assert.equal(ev.body.identification_code, "TESTCODE");
  assert.equal(ev.body.ip, "203.0.113.7");
});

test("forwards a session extension with code and url", async () => {
  received.length = 0;
  const q = new URLSearchParams({ nc: "1", code: "TESTCODE", url: "https://www.example.com/" });
  const r = await fetch(`${relayURL}${ENV.RELAY_SESSION_PATH}?${q}`, { method: "POST", headers: browserHeaders });
  assert.equal(r.status, 200);
  assert.equal(received[0].url, "/api/v1/session");
  assert.equal(received[0].body.code, "TESTCODE");
  assert.equal(received[0].body.url, "https://www.example.com/");
  assert.equal(received[0].body.ip, "203.0.113.7");
});

test("rejects a malformed event body without calling Pirsch", async () => {
  received.length = 0;
  const r = await fetch(`${relayURL}${ENV.RELAY_EVENT_PATH}`, { method: "POST", body: "not json" });
  assert.equal(r.status, 400);
  assert.equal(received.length, 0);
});

test("serves the optional event helper", async () => {
  const r = await fetch(`${relayURL}${ENV.RELAY_EVENTS_SCRIPT_PATH}`);
  assert.equal(r.status, 200);
  const js = await r.text();
  assert.match(js, /window\.relayEvent = relayEvent/);
  new Function(js); // must be valid JavaScript
});

test("robots.txt, preflight and unknown paths", async () => {
  const robots = await fetch(`${relayURL}/robots.txt`);
  assert.equal(await robots.text(), "User-agent: *\nDisallow: /\n");
  const pre = await fetch(`${relayURL}${ENV.RELAY_EVENT_PATH}`, { method: "OPTIONS" });
  assert.equal(pre.status, 204);
  const nf = await fetch(`${relayURL}/wp-login.php`);
  assert.equal(nf.status, 404);
});

test("refuses to run with missing configuration", async () => {
  const saved = process.env.PIRSCH_ACCESS_KEY;
  delete process.env.PIRSCH_ACCESS_KEY;
  const origError = console.error;
  console.error = () => {};
  try {
    received.length = 0;
    const r = await fetch(`${relayURL}${ENV.RELAY_HIT_PATH}?code=X&url=https://www.example.com/`);
    assert.equal(r.status, 500);
    assert.equal(received.length, 0);
  } finally {
    console.error = origError;
    process.env.PIRSCH_ACCESS_KEY = saved;
  }
});
