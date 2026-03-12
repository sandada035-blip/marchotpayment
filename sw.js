const CACHE_NAME = 'school-pay-v2-pwa';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png'
];

const API_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(
        () =>
          new Response(JSON.stringify({ success: false, message: 'Offline or API unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      });
    })
  );
});
