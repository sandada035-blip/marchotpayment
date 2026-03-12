const CACHE_NAME = "school-pay-v4-single-page";
const STATIC_FILES = ["./","./index.html","./style.css","./script.js","./manifest.json","./logo.png","./vercel.json"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))); self.clients.claim(); });
self.addEventListener("fetch", (event) => {
  const req = event.request; const url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.includes("script.google.com") || url.hostname.includes("script.googleusercontent.com")) { event.respondWith(fetch(req, { cache: "no-store" })); return; }
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => { if (!res || res.status !== 200) return res; const clone = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)); return res; }).catch(() => caches.match("./index.html"))));
});
