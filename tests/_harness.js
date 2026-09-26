// CrewAssist behaviour-test harness.
// Boots the real index.html in jsdom (no build step, no browser) and hands back
// a window/document pair wired with the minimum stubs the app needs to run.
//
// Conventions (see tests/README.md):
//  - Assert OUTCOMES (what the app does), not internals (how it is written).
//  - Suites are named by feature, not by app version.
//
// Gotcha that cost us a day once: do NOT dispatch DOMContentLoaded manually.
// jsdom fires its own (exactly once) shortly after the scripts are evaluated;
// dispatching it as well double-runs bindEvents() and every listener fires
// twice (the 10-tap dev toggle toggled twice per 10 taps). Just await wait(400).

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP = path.resolve(__dirname, '..', 'index.html');
const RATES = fs.readFileSync(path.resolve(__dirname, '..', 'rates.json'), 'utf8');

let pass = 0, fail = 0, firstFail = null;
const R = {
    eq(a, b, l) { if (a === b) pass++; else { fail++; if (!firstFail) firstFail = `${l}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`; } },
    ok(c, l) { if (c) pass++; else { fail++; if (!firstFail) firstFail = `${l}: expected truthy, got ${JSON.stringify(c)}`; } },
    done() { console.log(`\n${pass} passed, ${fail} failed`); if (firstFail) console.log('first fail: ' + firstFail); return fail; }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(appPath, opts) {
    const html = fs.readFileSync(APP, 'utf8').replace(/<script\s+src=[^>]*><\/script>/g, '');
    const dom = new JSDOM(html, { url: 'https://crewassist.test/', pretendToBeVisual: true, runScripts: 'outside-only' });
    const w = dom.window, d = w.document;
    // The app calls lucide.createIcons() after renders; icons are cosmetic for tests.
    w.lucide = { createIcons() {} };
    // No service worker in jsdom; the app guards registration but stub to be safe.
    Object.defineProperty(w.navigator, 'serviceWorker', { value: undefined, configurable: true });
    // Network: repo rates.json for the shipped-rates fetch; everything else offline.
    const origFetch = w.fetch;
    // jsdom's window has no Response constructor, so build the stubbed replies
    // with Node's global Response (same .ok/.json() surface the app reads).
    // The /api/sq branch intentionally still replies 500 offline-style —
    // suites rely on offline/error paths exercising there.
    w.fetch = async (u) => {
        const url = typeof u === 'string' ? u : u.url;
        if (url.indexOf('/rates.json') !== -1) return new Response(RATES, { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.indexOf('/api/sq') !== -1 || url.indexOf('crewassist-sandpit') !== -1) return new Response(JSON.stringify({ success: false, message: 'offline in test' }), { status: 500 });
        return origFetch ? origFetch(u) : new Response('{}', { status: 200 });
    };
    w.open = () => null;
    w.__scrollSpy = null;
    w.Element.prototype.scrollTo = function (opts) { if (w.__scrollSpy) w.__scrollSpy(opts); };
    w.Element.prototype.scrollIntoView = function () {};
    w.scrollTo = function () {};
    // jsdom has no innerText; the app reads it in a few places.
    Object.defineProperty(w.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; }, set(v) { this.textContent = v; } });
    // Canvas: return a Proxy that absorbs any 2D-context call (charts, exports).
    const mkCtx = () => { const grad = { addColorStop() {} }; const fn = () => grad; return new Proxy({}, { get: (t, k) => (k in t ? t[k] : fn), set: (t, k, v) => { t[k] = v; return true; } }); };
    w.HTMLCanvasElement.prototype.getContext = function () { return mkCtx(); };
    // Evaluate every inline script in document order, like a browser would.
    const scripts = Array.from(d.querySelectorAll('script:not([src])')).map((s) => s.textContent);
    for (const code of scripts) { try { w.eval(code); } catch (e) { if (!/serviceWorker|tailwind/.test(String(e))) console.log('script err: ' + e); } }
    // Seed hook: run before the app's DOMContentLoaded (which fires during the
    // wait below) so a suite can pre-load localStorage — profiles, rosters,
    // caches — exactly like a returning device would have them. (Re-added in
    // v1.28.0 for next-flight awareness; it is a general harness capability.)
    if (opts && opts.seed) { try { opts.seed(w, d); } catch (e) { console.log('seed err: ' + e); } }
    // jsdom fires its own DOMContentLoaded while we wait; see the header comment.
    await wait(400);
    // The what's-new sheet (fresh versions) holds the welcome chat until
    // it's closed — close it like a user would, unless a suite asks to keep
    // it open to test that deferral itself.
    if (!(opts && opts.keepWhatsNew)) {
        const wnBackdrop = d.getElementById('whatsnew-backdrop');
        const wnClose = d.getElementById('whatsnew-close');
        if (wnBackdrop && wnClose && !wnBackdrop.classList.contains('hidden')) wnClose.click();
    }
    return { w, d };
}

module.exports = { R, boot, wait, APP };
