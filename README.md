# pirsch-relay

Cookieless website analytics that ad blockers don't silently swallow.

`pirsch-relay` is a tiny, self-hosted proxy for [Pirsch Analytics](https://pirsch.io)
that runs on Vercel under a subdomain of your own site (for example
`a.example.com`). It serves the Pirsch script and forwards page views, events
and sessions to the Pirsch API. To the browser, everything is first-party.

[🇩🇪 Deutsche Kurzfassung](#deutsche-kurzfassung)

```
Browser ──► a.example.com (your subdomain, Vercel Edge, Frankfurt) ──► api.pirsch.io
            serves pa.js, forwards hits/events                          your dashboard
            adds the access key server-side
```

## Why

- **No cookie banner needed for analytics.** Pirsch sets no cookies and stores
  nothing on the device; visitors are counted with a daily rotating,
  non-reversible hash. In most setups that means analytics without consent.
  (Check your own situation — see [Privacy](#privacy).)
- **Ad blockers stop deleting your numbers.** Blocklists filter
  `api.pirsch.io` like every other analytics domain. Requests to your own
  subdomain on neutral paths are not on those lists. Visitors with a blocker
  are a large share of the traffic on many sites; with the direct snippet they
  simply don't exist in your reports.
- **Independent of your CMS.** The relay lives on its own subdomain. Moving
  from WordPress to Framer (or anywhere else) doesn't touch it — you only
  paste the snippet again.
- **Cheap.** Pirsch is a paid service with a 30-day free trial; plans start at
  $6/month for 10,000 monthly page views (as of November 2026, see
  [pirsch.io/pricing](https://pirsch.io/pricing)). The relay itself is one
  edge function. Note that Vercel's free Hobby plan is for non-commercial use
  only; a business website belongs on a paid Vercel plan.

## What's in here

| File | Purpose |
|---|---|
| `api/proxy.js` | The relay: script, page views, events, sessions. Configured only through env vars. |
| `lib/events.js` | Optional event helper (phone/e-mail clicks, safe `window.relayEvent`). |
| `snippet.html` | The script tag for your site. |
| `.env.example` | All configuration options. |
| `DATENSCHUTZ-VORLAGE.md` | German privacy policy template (not legal advice). |
| `scripts/local.mjs` | Run the relay locally with plain Node. |
| `test/proxy.test.mjs` | End-to-end test against a mock Pirsch API. |

No dependencies, no build step.

## Setup

You need: a Pirsch account with a dashboard for your site, a Vercel account,
and access to your domain's DNS.

### 1. Get your Pirsch credentials

In Pirsch, open your dashboard → **Settings → Integration**:

- the **Identification Code** (public, goes into the snippet), and
- a new **Access Key** with write permission (secret, goes into Vercel only).

### 2. Choose your paths

The relay answers on four paths you choose yourself. Use neutral names — no
`track`, `analytics`, `pirsch`, `hit`, `event`, `pageview` — and **don't copy
someone else's**: identical paths across many sites are exactly the kind of
pattern blocklists learn. This generates a random set:

```bash
node -e "const r=()=>Math.random().toString(36).slice(2,6);console.log('/'+r()+'/'+r()+'.js','/'+r()+'/'+r(),'/'+r()+'/'+r(),'/'+r()+'/'+r())"
```

### 3. Deploy to Vercel

**One click:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FKUBE-Studio%2Fpirsch-relay&project-name=pirsch-relay&repository-name=pirsch-relay&env=PIRSCH_ACCESS_KEY,RELAY_SCRIPT_PATH,RELAY_HIT_PATH,RELAY_EVENT_PATH,RELAY_SESSION_PATH&envDescription=Pirsch%20access%20key%20and%20your%20four%20relay%20paths&envLink=https%3A%2F%2Fgithub.com%2FKUBE-Studio%2Fpirsch-relay%23configuration)

Vercel copies the repository into your GitHub account and asks for the five
required variables.

**Or with the CLI:**

```bash
git clone https://github.com/KUBE-Studio/pirsch-relay.git && cd pirsch-relay
```

```bash
vercel deploy --prod
```

Then add the variables (Project → Settings → Environment Variables, or
`vercel env add <NAME> production`) and **deploy again** — environment
variables only apply to new deployments. Framework preset: *Other*, no build
command.

### 4. Add your subdomain

Vercel → Project → **Settings → Domains** → add `a.example.com` (any
subdomain works). Create the CNAME record exactly as Vercel shows it, at the
DNS provider that actually serves your zone (`dig example.com NS` tells you
which one — that's not always where the domain was bought).

Use a subdomain of the **same registrable domain** as your website. A relay on
a different domain is third-party again.

### 5. Smoke test

```bash
curl -sI https://a.example.com/<RELAY_SCRIPT_PATH>
```

Expect `200` and `content-type: application/javascript`.
`https://a.example.com/robots.txt` should return `Disallow: /`.

### 6. Add the snippet to your site

Take `snippet.html`, replace the subdomain, the identification code and the
four paths, and put it into the `<head>` of every page. **Remove the old
Pirsch snippet** (`api.pirsch.io`) at the same time, otherwise visits count
twice.

**Plain HTML / any CMS:** paste it before `</head>` in your layout template.

**Framer:** Site Settings → General → Custom Code → *End of `<head>` tag*,
then publish.

**WordPress:** use a header-code plugin, or add it from your child theme's
`functions.php`:

```php
add_action('wp_head', function () { ?>
  <!-- paste snippet.html here -->
<?php }, 1);
```

Exclude the script from "combine / delay / defer JavaScript" features of
caching and optimisation plugins: `pa.js` finds its configuration through
`id="pianjs"` and the `data-*` attributes, and rewritten tags lose them.

**Google Tag Manager:** possible, but it defeats the purpose. GTM itself is
blocked by most ad blockers and is usually tied to the cookie banner.

### 7. Verify with a blocker on

Open your site with an ad blocker (e.g. uBlock Origin) enabled. In the
browser's network tab, the requests to `a.example.com` should return `200`.
The Vercel function logs show the status Pirsch itself returned. Your own
visit should appear in the Pirsch dashboard within a minute or two. (Headless
browsers are filtered as bots by Pirsch, so automated tests don't show up
there.)

## Configuration

| Variable | Required | |
|---|---|---|
| `PIRSCH_ACCESS_KEY` | yes | Access key with write permission. Never commit it. |
| `RELAY_SCRIPT_PATH` | yes | Path that serves `pa.js`, e.g. `/static/q8vz/app.js` |
| `RELAY_HIT_PATH` | yes | Page views (`data-hit-endpoint`) |
| `RELAY_EVENT_PATH` | yes | Events (`data-event-endpoint`) |
| `RELAY_SESSION_PATH` | yes | Session extension (`data-session-endpoint`) |
| `RELAY_EVENTS_SCRIPT_PATH` | no | Serves `lib/events.js`. Empty = off. |
| `RELAY_ALLOWED_ORIGIN` | no | CORS origin, default `*` |
| `PIRSCH_BASE_URL` | no | Upstream, default `https://api.pirsch.io`. For tests. |

The paths in the env vars and the `data-*-endpoint` attributes in the snippet
**must match exactly.** If they don't, nothing is measured and nothing tells
you. Change both together.

If a required variable is missing, every tracking path answers
`500 relay not configured` and the function log lists what is missing.

**One deployment per Pirsch dashboard.** Every forwarded request is
authorised with the project's single access key, and access keys are scoped
to one dashboard. Don't attach a second, unrelated site to the same
deployment — give it its own project (it costs nothing extra) and its own
paths.

## Events

Pirsch counts outbound link clicks and file downloads on its own. For
everything else:

**HTML attributes** (no JavaScript):

```html
<a href="/pricing" pirsch-event="Pricing click" pirsch-meta-position="hero">See pricing</a>
```

**JavaScript:** always pass an options object.

```js
window.pirsch("Signup", { meta: { plan: "pro" } }); // ✓
window.pirsch("Signup", {});                        // ✓
window.pirsch("Signup");                            // ✗ sends nothing
```

Current versions of `pa.js` read `options.non_interactive` without checking
for `undefined`. Without a second argument the call throws inside the
returned promise, no request goes out, and at most an unhandled rejection
shows up in the console. Quick check on your site:
`await window.pirsch('test').catch(e => String(e))`.

**Optional helper** (`lib/events.js`): set `RELAY_EVENTS_SCRIPT_PATH`, load it
after the Pirsch snippet, and you get

- `phone_click` / `email_click` for every `tel:` / `mailto:` link
  (opt out per link with `data-relay-ignore`, or entirely with
  `data-relay-no-auto` on its script tag), and
- `window.relayEvent(name, meta)`, which waits for `pa.js` and always passes
  an options object.

Never put personal data into event names or metadata.

**Server-side events** (from a webhook or backend, sent straight to the
Pirsch API) are dropped silently if the `User-Agent` doesn't look like a
browser — `curl`, `node` or `python-requests` get a `200` and appear nowhere.
Send a browser-like user agent and check arrival in the dashboard, not the
status code.

## Execution region: EU

`api/proxy.js` pins the function to Frankfurt:

```js
export const config = { runtime: "edge", regions: ["fra1"] };
```

The relay passes the visitor's IP address to Pirsch (for the daily hash), so
the region matters for your privacy policy. Vercel needs this as a static
value in code; the project's region setting does not apply to it. Verify on a
**tracking path**, not on `/`: the response header `x-vercel-id` should read
`fra1::fra1`. If you change the region, change your privacy policy too.

## Privacy

Short version, not legal advice:

- No cookies, no local storage, no fingerprinting by the relay. It reads the
  visitor IP and user agent from the request and passes them to Pirsch, where
  the daily hash is created and the IP is discarded.
- The relay adds a processor: Vercel handles the IP address in transit, and
  Vercel's runtime logs contain the request path and query string (page URL,
  title, referrer). Retention depends on your Vercel plan.
- The relay does not make other tools on your page consent-free.

`DATENSCHUTZ-VORLAGE.md` contains a German privacy policy paragraph for this
setup, with the points to check before you use it.

## Run locally

```bash
cp .env.example .env
```

```bash
npm run local
```

The relay listens on `http://localhost:3000`. `npm test` runs an end-to-end
test against a local mock of the Pirsch API (Node 18+, no dependencies).

## Troubleshooting

| Symptom | Cause |
|---|---|
| `500 relay not configured` | A required env var is missing — the function log names it. After adding variables, redeploy. |
| `401` from the tracking paths | Access key missing, wrong, from another dashboard, or without write permission. Also: set but not redeployed. |
| `404` on a tracking path | Path in the snippet differs from the env var. |
| Visits counted twice | The old `api.pirsch.io` snippet is still on the page. |
| Custom events never arrive | `window.pirsch(name)` without options object, see [Events](#events). |
| Requests `200`, dashboard empty | Headless/automated browser (filtered as bot), or a server-side call with a non-browser user agent. |

## Made by Kube Studio

`pirsch-relay` is built and maintained by [Kube Studio](https://kube.studio),
a digital agency in Nuremberg, Germany. We run it in production for client
websites and published it because it is useful beyond our own projects.

Issues and pull requests are welcome. If you would rather have it set up for
you, [get in touch](https://kube.studio).

## License

[MIT](LICENSE) © Kugler Benz GmbH (Kube Studio). `api/proxy.js` is based on
the Cloudflare Worker example in
[pirsch-analytics/demo](https://github.com/pirsch-analytics/demo) (MIT).
Pirsch is a product of Emvi Software GmbH; this project is not affiliated
with it.

---

## Deutsche Kurzfassung

**Was ist das?** Ein kleiner, selbst gehosteter Proxy für Pirsch Analytics.
Er läuft auf Vercel unter einer Subdomain der eigenen Website (z. B.
`a.example.com`), liefert das Pirsch-Skript aus und leitet Seitenaufrufe und
Ereignisse an Pirsch weiter. Für den Browser ist alles First-Party.

**Warum?** Pirsch misst ohne Cookies, für die Webanalyse braucht es in der
Regel also kein Cookie-Banner. Werbeblocker sperren aber `api.pirsch.io` wie
jede andere Analyse-Domain, und Besucher mit Blocker fehlen dann in den
Zahlen. Über die eigene Subdomain mit neutralen Pfaden greifen diese Listen
nicht. Pirsch ist kostenpflichtig (30 Tage kostenlos testen, Tarife ab 6 $
im Monat für 10.000 Seitenaufrufe, Stand November 2026); der Proxy selbst ist
eine einzige Edge-Funktion. Für kommerzielle Websites braucht es einen
bezahlten Vercel-Tarif.

**Einrichten in Kürze:**

1. In Pirsch Identification Code notieren und einen Access Key mit
   Schreibrecht anlegen.
2. Vier eigene, nichtssagende Pfade wählen (Befehl oben unter *Choose your
   paths*). Nicht von anderen Websites übernehmen.
3. Mit dem Button *Deploy with Vercel* deployen und die fünf Variablen
   eintragen. Nach jeder Änderung an Variablen neu deployen.
4. In Vercel die Subdomain hinzufügen und den CNAME genau so anlegen, wie
   Vercel ihn anzeigt.
5. `snippet.html` anpassen und in den `<head>` jeder Seite setzen, bei Framer
   unter Site Settings → General → Custom Code, bei WordPress per
   Header-Plugin oder `wp_head`. Das alte Pirsch-Snippet entfernen, sonst
   zählt jeder Besuch doppelt.
6. Mit aktivem Werbeblocker prüfen: Anfragen an die Subdomain liefern `200`,
   der eigene Besuch erscheint im Dashboard.

**Ereignisse:** `window.pirsch(name, { meta: {...} })` immer mit
Optionen-Objekt aufrufen. Ohne zweites Argument sendet das aktuelle `pa.js`
nichts. Optional liefert das Relay ein Hilfsskript für Telefon- und
E-Mail-Klicks (`RELAY_EVENTS_SCRIPT_PATH`).

**Ausführungsregion:** fest auf Frankfurt (`fra1`) gesetzt, weil die IP des
Besuchers durch den Proxy läuft. Prüfbar über den Antwortkopf `x-vercel-id`
an einem Tracking-Pfad.

**Datenschutz:** Eine Vorlage für die Datenschutzerklärung liegt in
`DATENSCHUTZ-VORLAGE.md`. Sie ist keine Rechtsberatung und vor dem Einsatz
zu prüfen.

Gebaut von [Kube Studio](https://kube.studio), Digitalagentur in Nürnberg.
