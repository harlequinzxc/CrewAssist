const CACHE_NAME = 'crewassist-v17';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/favicon.svg',
    './icons/logo-192.png',
    './icons/logo-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isAppShell =
        req.mode === 'navigate' ||
        req.destination === 'document' ||
        url.pathname.endsWith('/sw.js') ||
        url.pathname.endsWith('/index.html') ||
        url.pathname.endsWith('/');

    if (isAppShell) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req))
    );
});
