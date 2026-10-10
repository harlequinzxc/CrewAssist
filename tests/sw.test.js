// Service worker: the real sw.js driven in a vm with stubbed caches/fetch —
// pins its actual contract: install precache + CDN retry, activate cleanup,
// network-first for shell/rates with both offline fallbacks, cache-first
// runtime backfill, and CDN URL identity with index.html (the duplication
// between the two files is deliberate — and now guarded).
const H = require('./_harness');
const { R } = H;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SW = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
const IX = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const BASE = 'https://crewassist.test';      // the SW's scope origin (no trailing slash)
const ORIGIN = BASE + '/';                   // base for relative-URL resolution
const CACHE = 'crewassist-v211';

// Real CacheStorage keys are absolute URLs — normalise the same way so the
// install's './index.html' and a navigation to the same document collide.
const urlOf = (x) => (typeof x === 'string' ? new URL(x, ORIGIN).href : x.url);
const Res = typeof Response === 'function' ? Response : class {
  constructor(body, init) {
    this._b = body; this.status = (init && init.status) || 200;
    this.ok = this.status >= 200 && this.status < 300; this.type = 'basic';
    this.headers = { get: (k) => (init && init.headers && init.headers[k]) || null };
  }
  clone() { return this; }
  text() { return Promise.resolve(this._b); }
};

function bootSW() {
  const handlers = {};
  const env = { attempts: {}, script: {}, skipWaitingCalls: 0, claimCalls: 0 };
  const sandbox = {
    setTimeout: (fn) => setTimeout(fn, 0), // retries resolve immediately; only order matters here
    Response: Res,
    URL, // vm contexts get ECMAScript intrinsics only — URL is a host API
    fetch: null
  };
  sandbox.fetch = (req) => {
    const u = urlOf(req);
    env.attempts[u] = (env.attempts[u] || 0) + 1;
    const s = env.script[u] || {};
    if ((s.failN && env.attempts[u] <= s.failN) || s.down) return Promise.reject(new TypeError('network error'));
    return Promise.resolve(s.respond || new Res('net:' + u));
  };
  class FakeCache {
    constructor(name) { this.name = name; this.store = new Map(); this.addCalls = []; this.addAllCalls = null; }
    put(req, res) { this.store.set(urlOf(req), res); return Promise.resolve(); }
    add(url) { const u = urlOf(url); this.addCalls.push(u); return sandbox.fetch(u).then((res) => { if (!res || !res.ok) throw new TypeError('bad response'); return this.put(u, res); }); }
    addAll(urls) { this.addAllCalls = urls.map(urlOf); return Promise.all(urls.map((u) => sandbox.fetch(u).then((res) => { if (!res || !res.ok) throw new TypeError('bad response'); return this.put(u, res); }))); }
    match(req) { return Promise.resolve(this.store.get(urlOf(req))); }
  }
  const store = new Map();
  sandbox.caches = {
    open: (name) => { if (!store.has(name)) store.set(name, new FakeCache(name)); return Promise.resolve(store.get(name)); },
    keys: () => Promise.resolve(Array.from(store.keys())),
    delete: (name) => Promise.resolve(store.delete(name)),
    match: (req) => { const u = urlOf(req); for (const c of store.values()) if (c.store.has(u)) return Promise.resolve(c.store.get(u)); return Promise.resolve(undefined); }
  };
  sandbox.self = sandbox;
  sandbox.location = { origin: BASE };
  sandbox.skipWaiting = () => { env.skipWaitingCalls++; return Promise.resolve(); };
  sandbox.clients = { claim: () => { env.claimCalls++; return Promise.resolve(); } };
  sandbox.addEventListener = (type, fn) => { handlers[type] = fn; };
  vm.createContext(sandbox);
  vm.runInContext(SW, sandbox, { filename: 'sw.js' });
  return {
    env, store, caches: sandbox.caches,
    fire: (type) => new Promise((resolve) => handlers[type]({ waitUntil: resolve })),
    drive: async (req) => {
      let answered = null;
      handlers.fetch({ request: req, respondWith: (p) => { answered = p; } });
      return { handled: answered !== null, res: answered ? await answered : undefined };
    },
    cache: () => store.get(CACHE),
    tick: () => new Promise((r) => setTimeout(r, 30))
  };
}

(async () => {
  // --- source shape: the refactor's own promises ---
  R.ok(SW.includes("const CACHE_NAME = '" + CACHE + "';"), 'cache name stays v211 — pure refactor, no bump');
  R.ok(!/v1\.\d/.test(SW) && !SW.includes('hotfix'), 'version-history stamps are gone; the comments describe current behaviour');
  R.eq((SW.match(/function cachePut/g) || []).length, 1, 'exactly one cachePut helper');
  R.eq((SW.match(/caches\.open\(CACHE_NAME\)/g) || []).length, 2, 'the cache is opened in install and in cachePut only — both inline put blocks are gone');
  R.ok(SW.includes('keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))'), 'activate states its intent: filter then delete');
  R.ok(SW.includes('const isNetworkFirst = isAppShell || isRates;'), 'the network-first strategy is named once');

  // --- install: precache + CDN URL identity with index.html ---
  let fontsUrl, lucideUrl, pdfUrls;
  {
    const { env, fire, cache, tick } = bootSW();
    await fire('install'); await tick();
    const c = cache();
    R.ok(!!c, 'install opens the v211 cache');
    R.ok(c.addAllCalls.indexOf(ORIGIN + 'index.html') !== -1 && c.addAllCalls.indexOf(ORIGIN + 'tw.css') !== -1 && c.addAllCalls.indexOf(ORIGIN + 'rates.json') !== -1, 'install precaches the shell, the compiled styles and rates');
    R.eq(c.addCalls.length, 4, 'the four CDN assets are fetched individually');
    fontsUrl = c.addCalls.filter((u) => u.indexOf('https://fonts.googleapis.com/css2') === 0)[0];
    lucideUrl = c.addCalls.filter((u) => u.indexOf('https://unpkg.com/') === 0)[0];
    pdfUrls = c.addCalls.filter((u) => u.indexOf('https://cdnjs.cloudflare.com/') === 0);
    R.eq(fontsUrl, IX.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)[1], "the precached fonts URL is byte-identical to index.html's stylesheet link");
    R.eq(lucideUrl, IX.match(/src="(https:\/\/unpkg[^"]+)"/)[1], "the precached lucide URL matches index.html's script tag");
    R.ok(pdfUrls.indexOf(IX.match(/const ROSTER_PDFJS_SRC = '([^']+)'/)[1]) !== -1 && pdfUrls.indexOf(IX.match(/const ROSTER_PDFJS_WORKER = '([^']+)'/)[1]) !== -1, "both precached pdf.js URLs match index.html's pinned constants");
    R.eq(env.skipWaitingCalls, 1, 'install skipWaiting — the new worker takes over at once');
  }

  // --- install: a flaky CDN asset is retried ---
  {
    const { env, fire, cache, tick } = bootSW();
    env.script[fontsUrl] = { failN: 2 };
    await fire('install'); await tick();
    R.eq(env.attempts[fontsUrl], 3, 'a flaky CDN asset is retried until it lands (2 fails + 1 success)');
    R.ok(cache().store.has(fontsUrl), 'the retried asset ends up cached');
  }

  // --- install: retry exhaustion is swallowed, the shell still installs ---
  {
    const { env, fire, cache, tick } = bootSW();
    env.script[lucideUrl] = { failN: 99 };
    let resolved = false;
    await fire('install').then(() => { resolved = true; });
    await tick();
    R.ok(resolved, 'install still resolves when a CDN asset stays down');
    R.eq(env.attempts[lucideUrl], 3, 'exactly CDN_RETRIES attempts, then the failure is swallowed');
    R.ok(!cache().store.has(lucideUrl), 'the dead asset is simply not cached');
  }

  // --- activate ---
  {
    const { env, fire, store, tick } = bootSW();
    store.set('crewassist-v209', {});
    store.set('crewassist-v210', {});
    store.set(CACHE, {});
    await fire('activate'); await tick();
    R.ok(store.size === 1 && store.has(CACHE), 'activate deletes every stale cache and keeps the current one');
    R.eq(env.claimCalls, 1, 'activate claims existing clients');
  }

  // --- fetch: network-first for the shell ---
  {
    const { drive, cache, tick } = bootSW();
    const r = await drive({ method: 'GET', mode: 'navigate', destination: 'document', url: ORIGIN });
    await tick();
    R.ok(r.handled && r.res.ok, 'a navigation is answered network-first');
    R.ok(cache().store.has(ORIGIN), 'the fresh navigation response is cached for offline');
  }

  // --- fetch: offline navigation falls back to the cached copy ---
  {
    const { env, fire, drive } = bootSW();
    await fire('install');
    env.script[ORIGIN] = { down: true };
    const r = await drive({ method: 'GET', mode: 'navigate', destination: 'document', url: ORIGIN });
    R.eq(await r.res.text(), 'net:' + ORIGIN, 'an offline navigation serves the cached shell');
  }

  // --- fetch: offline navigation on an uncached path falls back to index.html ---
  {
    const { env, fire, drive } = bootSW();
    await fire('install');
    const deep = ORIGIN + 'menu-viewer.html';
    env.script[deep] = { down: true };
    const r = await drive({ method: 'GET', mode: 'navigate', destination: 'document', url: deep });
    R.eq(await r.res.text(), 'net:' + ORIGIN + 'index.html', 'an uncached offline navigation falls back to the cached index.html');
  }

  // --- fetch: offline rates answers the synthetic 503 ---
  {
    const { env, drive } = bootSW(); // no install: rates never cached
    const u = ORIGIN + 'rates.json';
    env.script[u] = { down: true };
    const r = await drive({ method: 'GET', mode: 'cors', destination: '', url: u });
    R.ok(r.res.status === 503 && r.res.headers.get('Content-Type') === 'application/json' && (await r.res.text()) === '{}', 'offline rates answers 503 {} json when nothing is cached');
  }

  // --- fetch: cache-first with runtime backfill ---
  {
    const { env, caches, drive } = bootSW();
    const c = await caches.open(CACHE);
    c.store.set(ORIGIN + 'late.js', new Res('late:cached'));
    const r = await drive({ method: 'GET', mode: 'no-cors', destination: 'script', url: ORIGIN + 'late.js' });
    R.eq(await r.res.text(), 'late:cached', 'a cached runtime asset is served from cache');
    R.ok(env.attempts[ORIGIN + 'late.js'] === undefined, 'and the network is never touched for it');
  }

  {
    const { drive, cache, tick } = bootSW();
    const u = ORIGIN + 'late2.js';
    const r = await drive({ method: 'GET', mode: 'no-cors', destination: 'script', url: u });
    await tick();
    R.ok(r.res.ok && cache().store.has(u), 'a fresh same-origin asset is backfilled into the cache');
  }

  {
    const { env, drive, cache, tick } = bootSW();
    const u = 'https://unpkg.com/some-lib.js';
    env.script[u] = { respond: { ok: false, status: 0, type: 'opaque', clone() { return this; } } };
    await drive({ method: 'GET', mode: 'no-cors', destination: 'script', url: u });
    await tick();
    R.ok(cache().store.has(u), 'an opaque CDN response is still backfilled');
  }

  {
    const { env, drive, cache, tick } = bootSW();
    const u = 'https://unpkg.com/broken.js';
    env.script[u] = { respond: { ok: false, status: 500, type: 'basic', clone() { return this; } } };
    const r = await drive({ method: 'GET', mode: 'no-cors', destination: 'script', url: u });
    await tick();
    R.ok(!(cache() && cache().store.has(u)) && !r.res.ok, 'a failing basic response is served but not cached');
  }

  {
    const { drive, cache, tick } = bootSW();
    const u = 'https://evil.example/x.js';
    const r = await drive({ method: 'GET', mode: 'no-cors', destination: 'script', url: u });
    await tick();
    R.ok(r.res.ok && !(cache() && cache().store.has(u)), 'an off-list origin is served but never cached');
  }

  {
    const { drive } = bootSW();
    const r = await drive({ method: 'POST', url: ORIGIN + 'api' });
    R.ok(!r.handled, 'non-GET requests are not intercepted at all');
  }

  process.exit(R.done() ? 1 : 0);
})().catch((e) => { console.error('SUITE CRASHED', e); process.exit(1); });
