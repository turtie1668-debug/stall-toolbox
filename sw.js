/* 擺攤工具箱 — offline cache.
   App files: served from cache first, refreshed in the background when online.
   Google Fonts: cached the first time they load, so the right fonts also show offline.
   Your data never goes through here: it lives in the browser's IndexedDB on the device. */
const VER = "fox-stall-v7";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VER && k !== VER + "-fonts").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const net = fetch(req).then(res => {
      if (res && res.ok) caches.open(VER).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    e.waitUntil(net);
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("./index.html") : null);
      return hit || await net || new Response("離線中，且這個檔案還沒有快取。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })());
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const c = await caches.open(VER + "-fonts");
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      } catch (_) {
        return new Response("", { status: 504 });
      }
    })());
  }
});
