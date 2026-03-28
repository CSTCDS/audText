const CACHE_NAME = 'audiotexte-v1';
const FILES_TO_CACHE = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  if (url.pathname.startsWith('/assets/sounds/')) {
    evt.respondWith(fetch(evt.request).catch(() => caches.match(evt.request)));
    return;
  }
  evt.respondWith(caches.match(evt.request).then(r => r || fetch(evt.request)));
});
