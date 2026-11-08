// CrewAssist SQ proxy — B5 (owner-ordered): a server-side menu cache.
//
// Why: every install fetches cabin schedules and menus through this one
// proxy, so a popular flight is re-downloaded from SQ by each crew member.
// A shared cache answers repeats from storage instead — faster for the
// crew, gentler on the upstream — and when SQ is unreachable, a cache
// entry past its freshness window is still served, honestly marked stale.
//
// How: a Vercel KV / Upstash REST store, read through the standard
// KV_REST_API_URL + KV_REST_API_TOKEN environment variables. No bindings,
// no SDK — two fetch calls. Without the env pair the proxy behaves exactly
// as it did before this round: straight through, no cache, no errors.
//
// Keys: ca:sq:<endpoint>:<carrier>:<flight>:<date>[:<cabin>] — the menu
// key carries the cabin class, the getcabin key does not.
// Entries: { t: <saved-at ms>, d: <upstream JSON> }, application-level
// freshness of one day; the store entry itself expires after a week so
// abandoned flights do not linger forever.
// Only statusCode 200 successes are ever cached.
// Honesty: a fresh hit answers with X-CrewAssist-Cache: hit, a past-TTL
// copy served because SQ is unreachable answers with
// X-CrewAssist-Cache: stale — both carry X-CrewAssist-Cache-Saved-At so
// the app can say how old the copy is.

const UPSTREAM_BASE = 'https://cifp.auto.prod.c0.singaporeair.com/api/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // one day of freshness
const CACHE_STORE_TTL_S = 7 * 24 * 60 * 60; // the entry itself expires after a week
const CACHE_PREFIX = 'ca:sq:';

function kvConfig() {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    return (url && token) ? { url: String(url).replace(/\/+$/, ''), token: String(token) } : null;
}

async function kvGet(cfg, key) {
    try {
        const res = await fetch(cfg.url + '/get/' + encodeURIComponent(key), { headers: { Authorization: 'Bearer ' + cfg.token } });
        if (!res.ok) return null;
        const body = await res.json();
        if (!body || body.result == null) return null;
        const parsed = JSON.parse(body.result);
        return (parsed && typeof parsed === 'object' && typeof parsed.t === 'number' && parsed && 'd' in parsed) ? parsed : null;
    } catch (e) {
        return null; // the cache must never break the proxy
    }
}

async function kvSet(cfg, key, data) {
    try {
        const res = await fetch(cfg.url + '/set/' + encodeURIComponent(key) + '?EX=' + CACHE_STORE_TTL_S, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'text/plain' },
            body: JSON.stringify({ t: Date.now(), d: data })
        });
        return res.ok;
    } catch (e) {
        return false; // a failed write is a missed cache, nothing more
    }
}

function cacheKeyFor(endpoint, payload) {
    const base = CACHE_PREFIX + endpoint + ':' + String(payload.carrierId || '') + ':' + String(payload.flightNumber || '') + ':' + String(payload.flightDate || '');
    return (endpoint === 'menu' && payload.cabinClass) ? base + ':' + String(payload.cabinClass) : base;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { endpoint, payload } = req.body || {};

    if (!endpoint || (endpoint !== 'getcabin' && endpoint !== 'menu')) {
        return res.status(400).json({ error: 'Invalid endpoint' });
    }
    if (!payload || typeof payload !== 'object' || !payload.flightNumber || !payload.flightDate) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const cfg = kvConfig();
    const cacheKey = cacheKeyFor(endpoint, payload);
    let cached = null;
    if (cfg) {
        cached = await kvGet(cfg, cacheKey);
        if (cached && (Date.now() - cached.t) < CACHE_TTL_MS) {
            res.setHeader('X-CrewAssist-Cache', 'hit');
            res.setHeader('X-CrewAssist-Cache-Saved-At', String(cached.t));
            return res.status(200).json(cached.d);
        }
    }

    const targetUrl = UPSTREAM_BASE + endpoint;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://inflightmenu.singaporeair.com',
                'Referer': 'https://inflightmenu.singaporeair.com/',
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const data = await response.json();

        // only a genuine success is worth caching — never errors, never
        // unpublished flights (those flip to published any moment)
        if (cfg && response.ok && data && data.statusCode === 200) {
            await kvSet(cfg, cacheKey, data);
        }

        return res.status(200).json(data);
    } catch (error) {
        // SQ unreachable and the cache holds a past-TTL copy: serving it
        // beats failing, as long as the answer says how old it is
        if (cached) {
            res.setHeader('X-CrewAssist-Cache', 'stale');
            res.setHeader('X-CrewAssist-Cache-Saved-At', String(cached.t));
            return res.status(200).json(cached.d);
        }
        if (error.name === 'AbortError') {
            return res.status(504).json({ error: 'UPSTREAM_TIMEOUT' });
        }
        return res.status(502).json({ error: 'UPSTREAM_NETWORK', details: error.message });
    } finally {
        clearTimeout(timeoutId);
    }
}
