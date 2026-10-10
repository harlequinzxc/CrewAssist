const CACHE_NAME = 'crewassist-v211';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './tw.css',
    './rates.json',
    './icons/favicon.png',
    './icons/logo-192.png',
    './icons/logo-512.png',
    './icons/app-icon-180.png',
    './icons/app-icon-192.png',
    './icons/app-icon-512.png'
];
// Third-party assets the app needs on first offline launch (pdf.js for roster
// import, lucide icons, Google Fonts). The styles are the compiled, precached
// ./tw.css — no CSS compiler ever runs in the browser. Fetched individually
// so a CDN hiccup can never break the install of the core shell.
const FONTS_CSS_URL = [
    'https://fonts.googleapis.com/css2',
    '?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,500',
    '&family=Plus+Jakarta+Sans:wght@400;500;600;700',
    '&family=Space+Mono:ital,wght@0,400;0,700;1,400',
    '&display=swap'
].join('');
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://unpkg.com/lucide@latest',
    FONTS_CSS_URL
];
// A flaky CDN during install must not leave styles/icons silently missing
// offline. Retry each CDN asset a few times; the app-side shell guard turns
// a still-missing Tailwind into an honest repair screen instead of an
// unstyled page.
const CDN_RETRIES = 3;

// Runtime backfill — first-party files and known CDNs are cached as they
// are used while online, so fonts, icons and late-loaded libraries survive
// offline even when the install-time precache missed them.
const RUNTIME_CACHE_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
    'cdnjs.cloudflare.com'
];

function addWithRetry(cache, url, tries) {
    const attempt = (left) => cache.add(url).catch(() =>
        left > 1 ? new Promise((resolve) => setTimeout(resolve, 800)).then(() => attempt(left - 1)) : null
    );
    return attempt(tries);
}

function cachePut(req, res) {
    const copy = res.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS)
                .then(() => Promise.all(CDN_ASSETS.map((u) => addWithRetry(cache, u, CDN_RETRIES)))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
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
    const isNetworkFirst = isAppShell || isRates;

    if (isNetworkFirst) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) cachePut(req, res);
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

    const runtimeCacheable =
        url.origin === self.location.origin || RUNTIME_CACHE_HOSTS.indexOf(url.hostname) !== -1;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res && (res.ok || res.type === 'opaque') && runtimeCacheable) cachePut(req, res);
                return res;
            });
        })
    );
});
