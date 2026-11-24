// Optional event helper, served first-party by the relay when
// RELAY_EVENTS_SCRIPT_PATH is set. Load it after the Pirsch snippet:
//
//   <script defer src="https://a.example.com/<RELAY_EVENTS_SCRIPT_PATH>"></script>
//
// What it does:
//   - window.relayEvent(name, meta) — queues events until pa.js is ready and
//     always calls window.pirsch(name, { meta }) with an options object.
//     Calling window.pirsch(name) WITHOUT a second argument silently sends
//     nothing in current pa.js versions (TypeError inside the promise).
//   - Counts clicks on tel: and mailto: links as "phone_click" and
//     "email_click" (meta: page = path), and keeps pa.js from counting the
//     same click again as "Outbound Link Click". Opt out per link with the
//     attribute data-relay-ignore, or for the whole page with
//     data-relay-no-auto on the <script> tag that loads this file.
//
// Never put personal data (names, e-mail addresses, phone numbers, free text)
// into event names or metadata.
//
// Lives in lib/, not api/: every file under api/ becomes its own Vercel
// function (in the default region).
//
// Note for editing: the browser code below is a template literal. It must not
// contain backticks or the sequence dollar-sign + opening brace.

export const eventsJS = `(function () {
  "use strict";
  if (window.__pirschRelayEvents) return;
  window.__pirschRelayEvents = true;

  var queue = [];
  var waiting = false;

  function flush() {
    if (typeof window.pirsch !== "function") return;
    while (queue.length) {
      var job = queue.shift();
      try {
        var p = window.pirsch(job[0], { meta: job[1] });
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (e) { /* measurement must never break the page */ }
    }
  }

  function relayEvent(name, meta) {
    if (!name) return;
    var clean = {};
    if (meta && typeof meta === "object") {
      for (var k in meta) {
        if (Object.prototype.hasOwnProperty.call(meta, k)) clean[k] = String(meta[k]);
      }
    }
    queue.push([String(name), clean]);
    if (typeof window.pirsch === "function") { flush(); return; }
    if (waiting) return;
    waiting = true;
    var tries = 0;
    var timer = setInterval(function () {
      if (typeof window.pirsch === "function" || ++tries > 100) {
        clearInterval(timer);
        waiting = false;
        flush();
      }
    }, 100);
  }

  window.relayEvent = relayEvent;

  var current = document.currentScript;
  if (current && current.hasAttribute("data-relay-no-auto")) return;

  function isContactLink(el) {
    var href = (el.getAttribute("href") || "").trim().toLowerCase();
    return href.indexOf("tel:") === 0 || href.indexOf("mailto:") === 0;
  }

  /* pa.js would also count tel:/mailto: clicks as "Outbound Link Click".
     It binds those handlers on DOMContentLoaded, so mark the links before
     that — this works when this file is loaded with defer. */
  function skipOutbound() {
    try {
      var links = document.querySelectorAll("a[href]");
      for (var i = 0; i < links.length; i++) {
        if (isContactLink(links[i]) && !links[i].hasAttribute("data-relay-ignore")) {
          links[i].setAttribute("data-pirsch-ignore", "");
        }
      }
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === "loading") {
    document.addEventListener("readystatechange", function once() {
      document.removeEventListener("readystatechange", once);
      skipOutbound();
    });
  } else {
    skipOutbound();
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target;
    while (el && el.tagName !== "A") el = el.parentElement;
    if (!el || el.hasAttribute("data-relay-ignore") || !isContactLink(el)) return;
    var href = (el.getAttribute("href") || "").trim().toLowerCase();
    if (href.indexOf("tel:") === 0) relayEvent("phone_click", { page: location.pathname });
    else if (href.indexOf("mailto:") === 0) relayEvent("email_click", { page: location.pathname });
  }, true);
})();
`;
