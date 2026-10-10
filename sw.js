/* Liana Planner — service worker
   - the app shell is saved on the phone, so the site opens instantly and even without internet
   - index.html: shown from the saved copy right away, and refreshed quietly in the background
     (a new version appears the next time the app is opened)
   - manifest.json + app icons: always taken from the network first (so a new name or icon shows up
     right away); the saved copy is only used when there is no connection
   - images / fonts / sounds: saved the first time they are used
   - the server (workers.dev) and other websites are never touched by this file
   To force every phone to download everything again, change VERSION below. */
const VERSION = "liana-v3";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-192.png", "./icon-maskable-512.png",
  "./apple-touch-icon.png", "./Vazirmatn-RD-VF.woff2"
];
const inflight = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // one by one, so a single missing file can not stop the whole install
    await Promise.all(CORE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // server API, Google Fonts, ... go straight to the network
  if (url.pathname.indexOf("/api/") === 0) return;

  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") > -1) {
    event.respondWith(pageStrategy(req, event));
    return;
  }
  if (/\/(manifest\.json|apple-touch-icon\.png|icon-[^\/]*\.png)$/.test(url.pathname)) {
    event.respondWith(freshStrategy(req));
    return;
  }
  if (req.headers.has("range")) {                        // audio / video
    event.respondWith(rangeStrategy(req, event));
    return;
  }
  event.respondWith(assetStrategy(req));
});

async function pageStrategy(req, event) {
  const cache = await caches.open(VERSION);
  const cached = (await cache.match("./index.html", { ignoreSearch: true })) || (await cache.match("./", { ignoreSearch: true }));
  const refresh = fetch(new Request("./index.html", { cache: "no-cache" }))
    .then((res) => { if (res && res.ok) { cache.put("./index.html", res.clone()); } return res; })
    .catch(() => null);
  if (cached) { event.waitUntil(refresh); return cached; }
  const res = await refresh;                              // first ever visit: nothing saved yet
  return res || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

// manifest + app icons: network first (max 4 s), saved copy only as a fallback
async function freshStrategy(req) {
  const cache = await caches.open(VERSION);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(new Request(req.url, { cache: "no-cache", signal: ctl.signal }));
    clearTimeout(timer);
    if (res && res.status === 200) { cache.put(req.url, res.clone()); return res; }
  } catch (e) {}
  const hit = await cache.match(req.url, { ignoreSearch: true });
  return hit || new Response("", { status: 504 });
}

async function assetStrategy(req) {
  const cache = await caches.open(VERSION);
  const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response("", { status: 504 });
  }
}

// sounds are played with "Range" requests: answer them from the saved file when we have it
async function rangeStrategy(req, event) {
  const cache = await caches.open(VERSION);
  const full = await cache.match(req.url, { ignoreSearch: true });
  if (full) {
    const blob = await full.blob();
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : blob.size - 1;
    if (end >= blob.size) end = blob.size - 1;
    if (start > end) start = 0;
    return new Response(blob.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": "bytes " + start + "-" + end + "/" + blob.size,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes"
      }
    });
  }
  // not saved yet: play it from the network now, and save the whole file quietly for next time
  if (!inflight.has(req.url)) {
    inflight.add(req.url);
    event.waitUntil(
      fetch(req.url).then((res) => { if (res && res.status === 200) return cache.put(req.url, res); })
        .catch(() => {}).finally(() => inflight.delete(req.url))
    );
  }
  return fetch(req);
}
