// Server-side menu cache (B5, v1.56.0, owner-ordered): the SQ proxy's KV
// cache. The real handler is imported and driven with mocked req/res, a
// mocked upstream fetch and a mocked KV REST store — the module is ESM
// (Vercel's runtime reads it that way), so a data-URL import gives Node
// the same reading without a package.json in api/.
// The B1 rule holds here too: without the KV env pair the proxy must
// behave exactly as the pre-B5 file did — straight through, no cache.
const fs = require('fs');
const path = require('path');
const { R } = require('./_harness');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'sq.js'), 'utf8');

// ---- the mock world ----
const KV_BASE = 'https://kv.test';
const UPSTREAM_DATA = { statusCode: 200, cabinClasses: ['JCL', 'YCL'], legs: [{ flightDetails: { departureAirportCode: 'SIN' } }] };
const UNPUBLISHED_DATA = { statusCode: 101 };

function makeRes() {
    const r = {
        statusCode: null, body: null, _headers: {},
        setHeader(k, v) { r._headers[String(k).toLowerCase()] = String(v); },
        status(c) { r.statusCode = c; return r; },
        json(o) { r.body = o; return r; }
    };
    return r;
}

// Upstream behaviour and KV behaviour per case; calls are recorded.
let upstreamMode = 'ok';          // ok | unpublished | reject | abort
let kvStore = {};                  // key -> { t, d }
let kvGetFails = false;
let kvSetFails = false;
let calls = { upstream: [], kvGet: [], kvSet: [] };

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.indexOf('singaporeair.com') !== -1) {
        calls.upstream.push({ url: u, body: init && init.body ? JSON.parse(init.body) : null });
        if (upstreamMode === 'reject') throw new Error('boom: upstream unreachable');
        if (upstreamMode === 'abort') { const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e; }
        return new Response(JSON.stringify(upstreamMode === 'unpublished' ? UNPUBLISHED_DATA : UPSTREAM_DATA), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf(KV_BASE) === 0) {
        if (u.indexOf('/get/') !== -1) {
            calls.kvGet.push(decodeURIComponent(u.slice(KV_BASE.length + '/get/'.length)));
            if (kvGetFails) throw new Error('kv down');
            const key = decodeURIComponent(u.slice(KV_BASE.length + '/get/'.length));
            const hit = Object.prototype.hasOwnProperty.call(kvStore, key) ? kvStore[key] : null;
            return new Response(JSON.stringify({ result: hit ? JSON.stringify(hit) : null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (u.indexOf('/set/') !== -1) {
            calls.kvSet.push({ url: u, body: init && init.body ? JSON.parse(init.body) : null });
            if (kvSetFails) throw new Error('kv down');
            const key = decodeURIComponent(u.slice(KV_BASE.length + '/set/'.length).split('?')[0]);
            kvStore[key] = init && init.body ? JSON.parse(init.body) : null;
            return new Response(JSON.stringify({ result: 'OK' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
    }
    return realFetch(url, init);
};

function resetWorld() {
    upstreamMode = 'ok';
    kvStore = {};
    kvGetFails = false;
    kvSetFails = false;
    calls = { upstream: [], kvGet: [], kvSet: [] };
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
}

const REQ = (body) => ({ method: 'POST', headers: { 'user-agent': 'test' }, body });

(async () => {
  const mod = await import('data:text/javascript,' + encodeURIComponent(SRC));
  const handler = mod.default;

  // --- the pre-B5 contract, unchanged ---
  {
    resetWorld();
    let r = await handler({ method: 'GET', headers: {} }, makeRes());
    R.eq(r.statusCode, 405, 'GET is refused — POST only, as before');
    r = await handler(REQ({ endpoint: 'trackusage', payload: {} }), makeRes());
    R.eq(r.statusCode, 400, 'an unknown endpoint is refused — getcabin and menu only');
    R.eq(r.body.error, 'Invalid endpoint', 'the endpoint refusal names itself');
    r = await handler(REQ({ endpoint: 'menu', payload: { flightDate: '2026-11-10' } }), makeRes());
    R.eq(r.statusCode, 400, 'a payload without a flight number is refused before any upstream call');
    R.eq(r.body.error, 'Invalid payload', 'the payload refusal names itself');
    R.eq(calls.upstream.length, 0, 'none of the refusals reached the upstream');
  }

  // --- no KV env: straight through, byte-for-byte the old behaviour ---
  {
    resetWorld();
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 200, 'no-KV: a happy upstream passes through as 200');
    R.eq(JSON.stringify(r.body), JSON.stringify(UPSTREAM_DATA), 'no-KV: the upstream body passes through untouched');
    R.eq(r._headers['x-crewassist-cache'], undefined, 'no-KV: no cache headers are invented');
    R.eq(calls.upstream.length, 1, 'no-KV: the upstream was called exactly once');
    R.eq(calls.kvGet.length, 0, 'no-KV: the KV store is never read');
    R.eq(calls.kvSet.length, 0, 'no-KV: the KV store is never written');
  }

  // --- KV env, cache miss: look up, fetch, store ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(calls.kvGet.length, 1, 'miss: the cache is consulted first');
    R.eq(calls.kvGet[0], 'ca:sq:menu:SQ:802:2026-11-10:JCL', 'the menu key carries flight + date + cabin');
    R.eq(calls.upstream.length, 1, 'miss: a miss falls through to the upstream');
    R.eq(calls.kvSet.length, 1, 'miss: a 200 success is stored for the next crew');
    R.eq(JSON.stringify(calls.kvSet[0].body.d), JSON.stringify(UPSTREAM_DATA), 'the stored payload is the upstream body');
    R.ok(calls.kvSet[0].url.indexOf('EX=604800') !== -1, 'the stored entry carries a one-week store expiry');
    R.eq(r._headers['x-crewassist-cache'], undefined, 'miss: the answer does not claim a cache hit');
  }

  // --- KV env, getcabin key: no cabin suffix ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    await handler(REQ({ endpoint: 'getcabin', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10' } }), makeRes());
    R.eq(calls.kvGet[0], 'ca:sq:getcabin:SQ:802:2026-11-10', 'the getcabin key carries flight + date, no cabin');
  }

  // --- KV env, fresh hit: the upstream is never called ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    const savedAt = Date.now() - 3600000; // one hour old
    kvStore['ca:sq:menu:SQ:802:2026-11-10:JCL'] = { t: savedAt, d: UPSTREAM_DATA };
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(calls.upstream.length, 0, 'fresh hit: the upstream is never called');
    R.eq(JSON.stringify(r.body), JSON.stringify(UPSTREAM_DATA), 'fresh hit: the cached body is served');
    R.eq(r._headers['x-crewassist-cache'], 'hit', 'fresh hit: the honesty marker says hit');
    R.eq(r._headers['x-crewassist-cache-saved-at'], String(savedAt), 'fresh hit: the saved-at marker carries the true age');
    R.eq(calls.kvSet.length, 0, 'fresh hit: nothing is re-stored');
  }

  // --- stale entry, upstream healthy: refreshed like a miss ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    kvStore['ca:sq:menu:SQ:802:2026-11-10:JCL'] = { t: Date.now() - 26 * 3600000, d: { statusCode: 200, old: true } };
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(calls.upstream.length, 1, 'stale: a past-TTL entry falls through to the upstream');
    R.eq(r._headers['x-crewassist-cache'], undefined, 'stale + healthy: the refreshed answer does not claim a hit');
    R.eq(calls.kvSet.length, 1, 'stale: the refresh is stored back');
  }

  // --- stale entry, upstream unreachable: served, honestly marked ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    upstreamMode = 'reject';
    const savedAt = Date.now() - 26 * 3600000;
    kvStore['ca:sq:menu:SQ:802:2026-11-10:JCL'] = { t: savedAt, d: UPSTREAM_DATA };
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 200, 'stale + unreachable: the last copy still answers');
    R.eq(JSON.stringify(r.body), JSON.stringify(UPSTREAM_DATA), 'stale + unreachable: the served body is the cached one');
    R.eq(r._headers['x-crewassist-cache'], 'stale', 'stale + unreachable: the honesty marker says stale');
    R.eq(r._headers['x-crewassist-cache-saved-at'], String(savedAt), 'stale + unreachable: the true age rides the header');
  }

  // --- upstream unreachable, nothing cached: the pre-B5 error shapes hold ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    upstreamMode = 'abort';
    let r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 504, 'abort: the timeout shape is 504 UPSTREAM_TIMEOUT, as before');
    R.eq(r.body.error, 'UPSTREAM_TIMEOUT', 'abort: the error name survives');
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    upstreamMode = 'reject';
    r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 502, 'reject: the network shape is 502 UPSTREAM_NETWORK, as before');
    R.eq(r.body.error, 'UPSTREAM_NETWORK', 'reject: the error name survives');
  }

  // --- unpublished flights are never cached ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    upstreamMode = 'unpublished';
    const r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(JSON.stringify(r.body), JSON.stringify(UNPUBLISHED_DATA), 'unpublished: the 101 passes through');
    R.eq(calls.kvSet.length, 0, 'unpublished: a 101 is never stored — it flips to published any moment');
  }

  // --- the cache must never break the proxy ---
  {
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    kvGetFails = true;
    let r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 200, 'kv get down: the proxy still answers from the upstream');
    R.eq(calls.upstream.length, 1, 'kv get down: the upstream was still called');
    resetWorld();
    process.env.KV_REST_API_URL = KV_BASE;
    process.env.KV_REST_API_TOKEN = 'tok';
    kvSetFails = true;
    r = await handler(REQ({ endpoint: 'menu', payload: { carrierId: 'SQ', flightNumber: '802', flightDate: '2026-11-10', cabinClass: 'JCL' } }), makeRes());
    R.eq(r.statusCode, 200, 'kv set down: the proxy still answers — a failed write is a missed cache, nothing more');
  }

  process.exit(R.done() ? 1 : 0);
})();
