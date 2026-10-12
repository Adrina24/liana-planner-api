/* Liana Planner — service worker
   - the app shell is saved on the phone, so the site opens instantly and even without internet
   - index.html: shown from the saved copy right away, and refreshed quietly in the background
     (a new version appears the next time the app is opened)
   - manifest.json + app icons: always taken from the network first (so a new name or icon shows up
     right away); the saved copy is only used when there is no connection
   - images / fonts / sounds: saved the first time they are used
   - the server (workers.dev) and other websites are never touched by this file
   To force every phone to download everything again, change VERSION below. */
const VERSION = "liana-v5";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-192.png", "./icon-maskable-512.png",
  "./apple-touch-icon.png", "./Vazirmatn-RD-VF.woff2",
  "./img/img-f2f7ae76.webp",
  "./img/img-00b1766f.webp",
  "./img/img-a02a0306.webp",
  "./img/img-ce41adf5.webp",
  "./img/img-5bef8da6.webp",
  "./img/normal-5bd6b909.webp",
  "./img/waveOpen-c27b3a7d.webp",
  "./img/waveClose-21cffe79.webp",
  "./img/enthusiasm-097846f9.webp",
  "./img/lovely-ed1e5463.webp",
  "./img/sleepy-e0b1a1e7.webp",
  "./img/sad-18f72f87.webp",
  "./img/worriedChin-557e8f38.webp",
  "./img/thinking-c9fe9201.webp",
  "./img/gotIt-1eec42f0.webp",
  "./img/pointUp-3e03dba8.webp",
  "./img/claps-7d555b61.webp",
  "./img/laugh-17884a85.webp",
  "./img/amazed-313bb8d9.webp",
  "./img/victory-dfb9cb37.webp",
  "./img/doCheck-f203ba1b.webp",
  "./img/checkDone-ccb1fd60.webp",
  "./img/calm-02322468.webp",
  "./img/wave-397efb81.webp",
  "./img/kind-933ad80b.webp",
  "./img/LIANA_HOLO-69d38be1.webp",
  "./img/weight-18c4f712.webp",
  "./img/steps-de9ba7e4.webp",
  "./img/exercise-a683b428.webp",
  "./img/yoga-1f843e71.webp",
  "./img/water-b804b101.webp",
  "./img/nutrition-26d81333.webp",
  "./img/reading-7bb9dc8b.webp",
  "./img/selfcare-121e2af5.webp",
  "./img/mood-6ce73a0a.webp",
  "./img/journal-11509760.webp",
  "./img/sun-443f18a4.webp",
  "./img/moon-6fe54898.webp",
  "./img/settings-87e64ee4.webp",
  "./img/today-d7ed7c60.webp",
  "./img/tracker-445089e5.webp",
  "./img/chart-76e73bf7.webp",
  "./img/measure-c70c72ae.webp",
  "./img/star1-437cdd8c.webp",
  "./img/star2-3308b1cf.webp",
  "./img/star3-0d5eafd1.webp",
  "./img/star4-8ae785b6.webp",
  "./img/star5-06984de9.webp",
  "./img/plus-21cd1658.webp",
  "./img/sugarFree-85c22436.webp",
  "./img/cleaning-9a37bf83.webp",
  "./img/sleep-86b5f4e2.webp",
  "./img/stretch-f5d18d89.webp",
  "./img/meds-07696a39.webp",
  "./img/greetMorning-98aca1eb.webp",
  "./img/greetNoon-6a87305a.webp",
  "./img/greetEvening-eb218883.webp",
  "./img/greetNight-9ecaab37.webp",
  "./img/theme-e8eaf46b.webp",
  "./img/personalize-12319251.webp",
  "./img/backup-c48a939b.webp",
  "./img/restore-57f7fdf2.webp",
  "./img/downloadFile-78160292.webp",
  "./img/sendDrive-d75857b9.webp",
  "./img/account-cea43140.webp",
  "./img/bedMaking-4ebb94d0.webp",
  "./img/clothesTidy-1a0737db.webp",
  "./img/toothbrush-3e3142e1.webp",
  "./img/healthProfile-3051395a.webp",
  "./img/habits-c922a403.webp",
  "./img/fitness-de7f7ab0.webp",
  "./img/eat-12a8da06.webp",
  "./img/stress-70c6b44f.webp",
  "./img/learn-e22c1a5a.webp",
  "./img/sleep-e6a7dfa1.webp",
  "./img/img-3e68ef26.webp",
  "./img/img-30301483.webp",
  "./img/img-17534591.webp",
  "./img/img-f7baed6b.webp",
  "./img/img-7e8c47dd.webp",
  "./img/img-a9e1c90c.webp",
  "./img/img-893f578d.webp",
  "./img/img-07d49739.webp",
  "./img/img-246b58a4.webp"
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

/* ---------- reminder notifications (Web Push) ----------
   The server sends a small encrypted message at the reminder's time. If the app is open on screen
   we only tell it to check (it shows its own popup); otherwise we show a real notification. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "لیانا 💛";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (!data.force && wins.some((c) => c.visibilityState === "visible")) {
      wins.forEach((c) => c.postMessage({ type: "lp-reminder-check" }));
      return;
    }
    await self.registration.showNotification(title, {
      body: data.body || "",
      icon: "./icon-192.png",
      tag: data.tag || "liana-reminder",
      renotify: true,
      lang: "fa",
      dir: "rtl",
      data: { url: "./" }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.length) {
      const c = wins[0];
      try { await c.focus(); } catch (e) {}
      c.postMessage({ type: "lp-reminder-check" });
      return;
    }
    await self.clients.openWindow("./");
  })());
});
