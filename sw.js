const CACHE_NAME = 'crewassist-v135';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './rates.json',
    './icons/favicon.png',
    './icons/logo-192.png',
    './icons/logo-512.png',
    './icons/app-icon-180.png',
    './icons/app-icon-192.png',
    './icons/app-icon-512.png'
];
// Third-party assets the app needs on first offline launch (Tailwind runtime,
// pdf.js for roster import). Fetched individually so a CDN hiccup can never
// break the install of the core shell.
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS)
                .then(() => Promise.all(CDN_ASSETS.map((u) => cache.add(u).catch(() => null)))))
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
    const isRates = url.pathname.endsWith('/rates.json');

    if (isAppShell || isRates) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((cached) => {
                    if (cached) return cached;
                    if (isRates) return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
                    return caches.match('./index.html');
                }))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req))
    );
});
