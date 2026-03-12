const CACHE_NAME = "school-pay-pwa-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  // កែតម្រូវសំខាន់: ការពារមិនឲ្យ Service Worker ចាប់យកទិន្នន័យ API ទុកក្នុង Cache ទេ (ត្រូវទាញថ្មីជានិច្ច)
  if (event.request.url.includes("script.google.com") || event.request.url.includes("script.googleusercontent.com")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
