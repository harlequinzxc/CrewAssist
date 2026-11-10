// Compact browser smoke for CrewAssist v1.40.0 (the transit-meals release).
//
// The full behavioural contract lives in the jsdom suite (12 suites); this rig
// is the real-browser layer: boots the actual app in actual Chromium, holds it
// to zero page errors / zero console errors, checks the release stamps, the
// What's New sheet, and drives the headline v1.40.0 behaviours (the 3-hour
// transit gate and the report-time window boundary) through the real UI.
//
// Rebuilt from scratch on 2026-10-07 after the workspace restore wiped the
// original 89-check rig; kept deliberately compact (~20 checks).
const puppeteer = require('puppeteer-core');
// The sparticuz chromium build ships its own NSS/nspr libs (al2023.tar.br,
// extracted to /tmp/chr-libs/lib by the run script) — put them on the loader
// path before the browser process spawns.
process.env.LD_LIBRARY_PATH = ['/tmp/chr-libs/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
const chromium = require('@sparticuz/chromium').default;

const BASE = 'http://127.0.0.1:8799';
let pass = 0, fail = 0; const fails = [];
const ok = (c, l) => { if (c) { pass++; console.log('  ok  ' + l); } else { fail++; fails.push(l); console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, l + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CDN hosts the sandbox blocks by policy — their net failures are environment,
// not app defects, so they don't count as console errors.
const CDN = /fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdnjs\.cloudflare\.com/;
// Rig artifacts (the smoke serves no manifest/icons) — not app defects.
const RIG404 = /manifest\.json|\/icons\//;

async function resultsText(page) {
    await page.waitForFunction(() => !document.getElementById('results-backdrop').classList.contains('hidden'), { timeout: 20000 });
    await sleep(700); // let the breakdown rows render
    return page.evaluate(() => document.getElementById('results-content').innerText);
}
async function closeResults(page) {
    await page.evaluate(() => document.getElementById('results-backdrop').click());
    await page.waitForFunction(() => document.getElementById('results-backdrop').classList.contains('hidden'), { timeout: 10000 });
    await sleep(300);
}
// Fill a fresh 'both' card and calculate. `lma` = { iata, at, dt } on today.
async function calcCard(page, { type, t1, t2, lma }) {
    await page.evaluate(() => renderCalculatorCard('both'));
    await page.waitForFunction(() => !!document.querySelector('#chat-container [data-calc-card]'), { timeout: 10000 });
    await sleep(400);
    await page.evaluate((type, t1, t2, lma) => {
        const card = document.querySelector('#chat-container [data-calc-card]:last-of-type');
        const id = card.querySelector('input[id$="-ifa-fn1"]').id.slice(0, -'-ifa-fn1'.length);
        const today = new Date(); const ymd = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const set = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        set(document.getElementById(id + '-flight-type'), type);
        set(document.getElementById(id + '-ifa-fn1'), '123'); set(document.getElementById(id + '-ifa-fn2'), '124');
        set(document.getElementById(id + '-ifa-d1'), ymd); set(document.getElementById(id + '-ifa-d2'), ymd);
        set(document.getElementById(id + '-ifa-t1'), t1); set(document.getElementById(id + '-ifa-t2'), t2);
        set(document.getElementById(id + '-lma-iata1'), lma.iata);
        set(document.getElementById(id + '-lma-a1'), ymd); set(document.getElementById(id + '-lma-d1'), ymd);
        set(document.getElementById(id + '-lma-at1'), lma.at); set(document.getElementById(id + '-lma-dt1'), lma.dt);
        card.dispatchEvent(new Event('input', { bubbles: true }));
        window.__smokeCardId = id;
    }, type, t1, t2, lma);
    await sleep(300);
    await page.evaluate(() => document.getElementById(window.__smokeCardId + '-btn-calc').click());
}

(async () => {
    const exe = await chromium.executablePath();
    const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args, headless: chromium.headless, defaultViewport: { width: 390, height: 844, hasTouch: true } });
    try {
        const page = await browser.newPage();
        await page.emulateTimezone('Asia/Singapore');
        const pageErrors = [], consoleErrors = [];
        page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
        page.on('console', (m) => { if (m.type() === 'error') { const u = (m.location() && m.location().url) || ''; if (!CDN.test(u) && !RIG404.test(u) && !RIG404.test(m.text())) consoleErrors.push(m.text() + (u ? ' @' + u : '')); } });
        // v1.46.1: data: URL font loads (the painter's clone embeds the
        // house font as base64) are reported by CDP as requestfailed
        // (net::ERR_ABORTED) even though the font loads fine — the quirk is
        // excluded, and the boot block below pins the REAL proof that the
        // data-URL @font-face resolves in this Chromium (document.fonts.check)
        page.on('requestfailed', (r) => { const u = r.url() || ''; if (!CDN.test(u) && !RIG404.test(u) && u.indexOf('data:') !== 0) consoleErrors.push('requestfailed: ' + u); });

        console.log('— boot —');
        await page.evaluateOnNewDocument(() => { try { if (localStorage.getItem('__smokeFreshBoot')) return; localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' })); localStorage.setItem('crewAssist.wnSeen', '1.39.0'); localStorage.setItem('crewAssist.spotMainDone', '1'); localStorage.setItem('crewAssist.calcUi', 'manual'); localStorage.setItem('crewAssist.installHintDone', '1'); } catch (e) {} });
        // v1.45.58 rig fix: freeze the page clock at the seeded October. The
        // calendar section is date-anchored (October cells, an unflown
        // November leg), and the real clock flipped the default month to
        // November at the 2026-11-01 midnight, breaking the section. The
        // jsdom rigs pin now: the same discipline for the browser, at the
        // same instant the suites pin — every in-page new Date() agrees.
        await page.evaluateOnNewDocument(() => {
            const FIXED = Date.parse('2026-10-26T12:00:00+08:00');
            const RealDate = Date;
            class FixedDate extends RealDate {
                constructor(...args) { super(...(args.length ? args : [FIXED])); }
                static now() { return FIXED; }
            }
            window.Date = FixedDate;
        });
        await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('#chat-container', { timeout: 20000 });
        ok(true, 'the app boots to the chat view');
        ok(await page.evaluate(() => { const el = document.getElementById('ca-shell-fail'); return !el || getComputedStyle(el).display === 'none'; }), 'the shell guard passes (tw.css loaded, no repair screen)');
        ok(await page.evaluate(() => { const el = document.querySelector('.ca-micro'); return el && parseFloat(getComputedStyle(el).fontSize) <= 11.5; }), 'the compiled stylesheet applies (ca-micro renders at 11px)');
        ok(await page.evaluate(() => { const h = document.documentElement; const wasDark = h.classList.contains('dark'); h.classList.remove('dark'); const s = document.createElement('span'); s.className = 'text-sia-gold'; s.textContent = '.'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); if (wasDark) h.classList.add('dark'); return c; }) === 'rgb(125, 101, 15)', 'light-mode gold text computes to the measured #7d650f ink (divergence #3b: the rule rides the var token)');

        console.log('— release stamps —');
        eq(await page.evaluate(() => window.APP_VERSION), '1.58.0', 'APP_VERSION is 1.58.0');
        eq(await page.evaluate(() => window.APP_OPS.sq.enabled === true && window.APP_OPS.sq.path === '/api/sq' && window.APP_OPS.notice === null), true, 'the ops config boots with the shipped defaults — SQ on, default path, no notice');
        ok(await page.evaluate(() => fetch('/ops.json').then((r) => r.ok)), 'ops.json is served beside rates.json');
        ok(await page.evaluate(() => { const e = APP_CHANGELOG[0]; return e && e.v === '1.58.0' && e.d === '2026-11-17' && e.items.length === 3 && e.items.filter((i) => i.c === 'imp').length === 2 && e.items.filter((i) => i.c === 'new').length === 1; }), 'the changelog carries the 1.58.0 entry — two imp pointers and one new');
        ok((await page.evaluate(() => fetch('/sw.js').then((r) => r.text()))).includes('crewassist-v325'), 'the service-worker cache name is bumped to v325 (the v1.58.0 tour-close, fold-reset and hold-swipe release)');
        ok(!((await page.evaluate(() => fetch('/sw.js').then((r) => r.text()))).includes('html2canvas')), 'v1.47.1: the service worker precaches no painter at all — the cameras hand-paint, so captures are offline by construction');
        ok(await page.evaluate(() => Promise.all([400, 500, 600, 700].map((w) => fetch('/vendor/fonts/plus-jakarta-sans-' + w + '.woff2').then((r) => r.ok))).then((xs) => xs.every(Boolean))), 'v1.46.1: all four house-font weights are served locally — the capture arms them in the live document and the painter\u2019s clone inherits true metrics (no fallback widths, no wrapping, no clipped descenders)');
        ok(await page.evaluate(async () => {
            // the painter's clone embeds the house font as base64 data URLs —
            // prove the mechanism RESOLVES in this Chromium (the CDP
            // requestfailed report on data: URLs is known spurious noise)
            const res = await fetch('/vendor/fonts/plus-jakarta-sans-700.woff2');
            const bytes = new Uint8Array(await res.arrayBuffer());
            let bin = '';
            for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
            const st = document.createElement('style');
            st.textContent = "@font-face{font-family:'PJS Probe';font-style:normal;font-weight:700;src:url(data:font/woff2;base64," + btoa(bin) + ") format('woff2');}";
            document.head.appendChild(st);
            const probe = document.createElement('span');
            probe.style.cssText = "font-family:'PJS Probe';font-weight:700;position:absolute;visibility:hidden;";
            probe.textContent = 'Probe 123';
            document.body.appendChild(probe);
            try { await document.fonts.load("700 16px 'PJS Probe'"); } catch (e) {}
            await document.fonts.ready;
            return document.fonts.check("700 16px 'PJS Probe'");
        }), 'v1.46.1: the data-URL @font-face mechanism resolves in this Chromium — the painter\u2019s clone gets true font metrics');
        {
            // v1.46.3 (owner retest): the icon-baseline fix, proven at the
            // mechanism level in the real browser. The vendored painter
            // measures every font's baseline with a hidden probe — a plain
            // body-level div (inline "visibility: hidden" + "nowrap") holding
            // a text span and a 1x1 baseline-aligned img, read as
            // img.offsetTop − span.offsetTop + 2. The Tailwind preflight
            // (img{display:block}) drops the img below the span's line, so
            // the baseline comes out ~lineHeight instead of ~ascent and every
            // painted text rides a step low (the owner's half-cut icon
            // labels). Two scoped app-CSS rules restore the probe's assumed
            // environment — this block rebuilds the EXACT vendored probe
            // construction (span first, img second, plain div) and reads it.
            const probe = await page.evaluate(() => {
                const t = document.createElement('div');
                const r = document.createElement('img');
                const B = document.createElement('span');
                t.style.visibility = 'hidden';
                t.style.fontFamily = 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif';
                t.style.fontSize = '11px';
                t.style.margin = '0'; t.style.padding = '0'; t.style.whiteSpace = 'nowrap';
                document.body.appendChild(t);
                r.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                r.width = 1; r.height = 1;
                r.style.margin = '0'; r.style.padding = '0'; r.style.verticalAlign = 'baseline';
                B.style.fontFamily = t.style.fontFamily; B.style.fontSize = '11px';
                B.style.margin = '0'; B.style.padding = '0';
                B.appendChild(document.createTextNode('Hidden Text'));
                t.appendChild(B); t.appendChild(r);
                const out = { disp: getComputedStyle(r).display, lh: getComputedStyle(t).lineHeight, baseline: (r.offsetTop - B.offsetTop) + 2 };
                document.body.removeChild(t);
                return out;
            });
            eq(probe.disp, 'inline', 'v1.46.3: the font probe\u2019s 1x1 img computes INLINE — the Tailwind preflight\u2019s display:block is overridden inside the probe\u2019s footprint only');
            eq(probe.lh, 'normal', 'v1.46.3: the probe div measures at line-height normal — the span\u2019s box is the font box, not a 1.5 strut');
            ok(probe.baseline >= 10 && probe.baseline <= 14, 'v1.46.3: the measured baseline for the 11px house font lands at ~12 (the pre-fix block-img geometry measured ~18 — every painted text rode a step low; the owner\u2019s half-cut icon labels)');
        }

        console.log('— what\'s new —');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        ok(await page.evaluate(() => { const heads = document.querySelectorAll('#whatsnew-list .ca-micro'); return heads[0].textContent === 'v1.58.0'; }), 'the What\'s New sheet carries the v1.58.0 header');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Finishing the main tour brings you straight home to your chat.') !== -1), 'the What\'s New sheet carries the v1.58.0 tour-close pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Hold a menu photo, then swipe up or down to close it.') !== -1), 'the What\'s New sheet carries the v1.58.0 hold-swipe pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Dead code swept out — nothing you see changes.') !== -1), 'the What\'s New sheet carries the v1.57.1 tidy-up pointer, still in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A quiet ops switch: lookups can be paused or moved remotely.') !== -1), 'the What\'s New sheet carries the v1.55.0 ops-switch pointer, still in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Both empty months now read the same: No flights yet.') !== -1), 'the What\'s New sheet carries the v1.54.2 empty-calendar pointer, still in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The empty calendar reads shorter: No rosters yet., one tap below.') !== -1), 'the What\'s New sheet carries the v1.54.1 empty-calendar pointer, still in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A safety net speaks honestly if anything ever trips.') !== -1), 'the What\'s New sheet carries the v1.54.0 safety-net pointer, still in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The quieter Settings sections start folded — one tap opens them.') !== -1), 'the What\'s New sheet carries the v1.53.1 fold-default pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Settings folds its quieter sections — tap a header to open one.') !== -1), 'the What\'s New sheet carries the v1.53.0 settings-fold pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The main walk ends pointing at the tours — eight steps now.') !== -1), 'the What\'s New sheet carries the v1.53.0 eighth-step pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The calendar, flight stats and backup walks read anew — sharper copy.') !== -1), 'the What\'s New sheet carries the v1.52.0 walk-overhaul pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A tour never leaves your recent searches or saved menus touched.') !== -1), 'the What\'s New sheet carries the v1.52.0 storage-safe pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The manual, menus and earnings walks read anew — sharper copy.') !== -1), 'the What\'s New sheet carries the v1.51.0 walk-overhaul pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A tour never leaves the chip rail scrolled away.') !== -1), 'the What\'s New sheet carries the v1.51.0 chip-rail pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A gentle invitation opens the tour — Next walks, Skip stays quiet.') !== -1), 'the What\'s New sheet carries the v1.50.0 invitation pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Feature tour rows show a check when a walk is completed.') !== -1), 'the What\'s New sheet carries the v1.50.0 row-check pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('A walk\u2019s stage reverts when it ends — sheets, tags and all.') !== -1), 'the What\'s New sheet carries the v1.50.0 stage-revert pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Tour animations run even with reduced motion on.') !== -1), 'the What\'s New sheet carries the v1.50.0 reduced-motion pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Skip moves away from Next — no accidental taps end the walk.') !== -1), 'the What\'s New sheet carries the v1.49.3 button-order pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The spotlight veil darkens a little more — it reads harder.') !== -1), 'the What\'s New sheet carries the v1.49.3 veil pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The tour\u2019s first title reads At Your Service.') !== -1), 'the What\'s New sheet carries the v1.49.3 title-case pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The tour is a spotlight now — short, sharp, skippable.') !== -1), 'the What\'s New sheet carries the v1.49.0 spotlight pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Settings → Feature tour walks eight features, one tap each.') !== -1), 'the What\'s New sheet carries the v1.49.0 feature-tour door pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The stats tabs roll their numbers like the year pills.') !== -1), 'the What\'s New sheet carries the v1.48.5 flights-pills pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Earnings shares end at the last record — the since line is gone.') !== -1), 'the What\'s New sheet carries the v1.48.0 since-line pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The satay course reads Canapé — viewer and both print sheets.') !== -1), 'the What\'s New sheet carries the v1.48.0 satay-course Canapé pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The ethnic parting and Japan course defaults fire on real menu names.') !== -1), 'the What\'s New sheet carries the v1.48.0 real-names pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Shortcuts card reads only, takes multiple cabins, opens from the top.') !== -1), 'the What\'s New sheet carries the v1.48.0 shortcuts pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The figure roll always plays — and waits for the sheet.') !== -1), 'the What\'s New sheet carries the v1.48.0 roll pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Folded months stay folded in the earnings capture — no ghost stations.') !== -1), 'the What\'s New sheet carries the v1.47.2 folded-months pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Passport captures carry their title — All-Time, or the year.') !== -1), 'the What\'s New sheet carries the v1.47.1 passport-title pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The earnings camera joins the passport pattern — quick and exact.') !== -1), 'the What\'s New sheet carries the v1.47.1 earnings pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The passport camera repaints your hero card directly — quicker and exact.') !== -1), 'the v1.47.0 passport-repaint pointer stays in the delta below');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Captures finish in seconds — and the share sheet always opens.') !== -1), 'the What\'s New sheet carries the v1.46.4 capture-speed pointer in the delta');
        ok(await page.evaluate(() => !!document.querySelector('#cadate-prev [data-lucide="chevron-left"]') && !!document.querySelector('#cadate-next [data-lucide="chevron-right"]') && document.getElementById('cadate-prev').textContent.trim() === '' && document.getElementById('cadate-next').textContent.trim() === ''), 'v1.45.48: the calendar\u2019s month arrows carry true Lucide chevrons and no bare glyph text (markup pin - the rig\u2019s CDN stub keeps the stub element, so the structure is assertable even where the glyph itself is not)');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The earnings figure gets breathing room and a tidier stat grid.') !== -1), 'the What\'s New sheet carries the earnings-polish pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Every remaining colour wash rides a named token — same look.') !== -1), 'the What\'s New sheet carries the 1.44.6 one-off retirement pointer (sixth head now)');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Reopening earnings, menus, and print always starts fresh.') !== -1), 'the What\'s New sheet carries the 1.44.5 reopen-resets pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Swiping the date picker shows the months gliding under your finger.') !== -1), 'the What\'s New sheet carries the 1.44.3 swipe-visibility pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The date picker swipes and arrow-keys through months.') !== -1), 'the What\'s New sheet carries the 1.44.2 date-picker pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Every label now shares one fixed type scale.') !== -1), 'the What\'s New sheet carries the 1.44.1 type-scale pointer in the delta');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Type help in chat to see every command.') !== -1), 'the What\'s New sheet carries the 1.44.0 help pointer in the delta');
        ok(await page.evaluate(() => (document.getElementById('whatsnew-list').innerText.match(/1\.44\.4/g) || []).length === 1), 'the version appears exactly once (the white duplicate line is gone)');
        await page.click('#whatsnew-close');
        await page.waitForFunction(() => document.getElementById('chat-container').innerText.trim().length > 20, { timeout: 15000 });
        ok(await page.evaluate(() => document.getElementById('whatsnew-backdrop').classList.contains('hidden')), 'closing What\'s New releases the welcome chat (and hides its backdrop)');

        console.log('— v1.44.0 hotfix: the help card in the real browser —');
        // The greeting types first; a real user waits for the chat to go idle
        // before typing. Then "help" goes through the real composer: typed
        // key by key, sent with Enter.
        await page.waitForFunction(() => !isChatBusy(), { timeout: 20000 });
        await page.type('#chat-input', 'help');
        await page.keyboard.press('Enter');
        await page.waitForSelector('[data-ca-help-card]', { timeout: 15000 });
        ok(await page.evaluate(() => {
            const card = document.querySelector('[data-ca-help-card]');
            const rows = Array.from(card.querySelectorAll('[data-ca-help-row]'));
            const t = card.textContent.replace(/\s+/g, ' ');
            return rows.length === 5 && rows.map((r) => r.getAttribute('data-ca-help-row')).join(',') === 'menu,jcl menu,ifa,lma,cop'
                && rows.every((r) => r.tagName === 'DIV')
                && t.indexOf('Quick shortcuts') !== -1 && t.indexOf('Type any command below') !== -1;
        }), 'typing help answers with the structured card — five read-only rows in order, title + subtitle');
        // v1.45.59 (owner order) + v1.48.0: both word orders ride every row as
        // COMPLETE working pills, and the cabin row teaches the multi-cabin search
        ok(await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('[data-ca-help-card] [data-ca-help-row]'));
            const toks = (r) => Array.from(r.querySelectorAll('.ca-help-token')).map((t) => t.textContent);
            const gold = rows.some((r) => !!r.querySelector('.text-sia-gold'));
            return toks(rows[0]).join('|') === 'menu sq802 17 oct|sq802 menu 17 oct'
                && toks(rows[1]).join('|') === 'jcl menu sq802 17 oct|jcl ycl menu sq802 17 oct'
                && toks(rows[4]).join('|') === 'cop sq802 17 oct sq807 18 oct|sq802 cop 17 oct sq807 18 oct'
                && toks(rows[0]).every((x) => / \d{1,2} [a-z]{3,9}$/.test(x))
                && !gold;
        }), 'v1.48.1: every pill is a complete command with its keyword inside — both word orders on each row, and no gold word rides the read-only rows');
        // v1.48.2 (owner order): the pills read at FULL ink — computed in the
        // real browser, where the stylesheet actually resolves.
        ok(await page.evaluate(() => {
            const t = document.querySelector('[data-ca-help-card] .ca-help-token');
            return !!t && getComputedStyle(t).opacity === '1';
        }), 'v1.48.2: the command bubbles sit at opacity 1 — the muted .78 is gone, full ink in both themes');
        ok(await page.evaluate(() => {
            const a = parseNaturalCommand('jcl menu sq802 4 oct');
            const b = parseNaturalCommand('sq802 menu 4 oct');
            const c = parseNaturalCommand('sq802 lma 4 oct sq807 5 oct');
            return a && a.mode === 'menu' && a.cabins.join(',') === 'JCL' && b && b.mode === 'menu' && c && c.mode === 'lma' && c.pairs.length === 2;
        }), 'v1.45.59: the travelling command words parse in the real page — cabin-class searches and flight-number-first phrasings');
        ok(await page.evaluate(() => {
            const m = parseNaturalCommand('jcl ycl menu sq802 17 oct');
            return m && m.mode === 'menu' && m.cabins.join(',') === 'JCL,YCL';
        }), 'v1.48.0: a multi-cabin search parses in the real page — both cabins, in the crew\u2019s own order');
        // The rig serves no CDN (lucide ships from unpkg — blocked by policy),
        // so icons stay <i data-lucide> stubs here. The contract this layer
        // can pin: every glyph the card declares is a named Lucide icon —
        // bulb, four category icons, three tip dots, the CTA arrow — no
        // emoji, no custom SVG anywhere in the card.
        ok(await page.evaluate(() => {
            const card = document.querySelector('[data-ca-help-card]');
            const names = Array.from(card.querySelectorAll('i[data-lucide]')).map((i) => i.getAttribute('data-lucide'));
            const need = ['lightbulb', 'utensils', 'armchair', 'calculator', 'sandwich', 'map', 'dot', 'dot', 'dot', 'arrow-right'];
            return names.length === 10 && need.every((n) => names.indexOf(n) !== -1) && !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}]/u.test(card.textContent);
        }), 'the card declares only Lucide glyphs — bulb, five category icons (armchair for the cabin row), three tip dots, the CTA arrow — and no emoji');
        ok(await page.evaluate(() => { const t = document.querySelector('[data-ca-help-card]').textContent; return t.indexOf('sq 802 17 october') !== -1 && t.indexOf('4 october') === -1; }), 'v1.48.1: the plain-English tip dates its example 17 october — the card\u2019s own teaching date');
        // A real tap on a row: the keyword lands in the composer, focus
        // follows, and the row flashes gold (then the flash fades on its own).
        // Wait for idle first — while the chat is busy every chat button is
        // pointer-inert (the anti-double-fire rule), so a mid-typing tap
        // would rightly be swallowed.
        // v1.48.0 (owner order): the rows READ ONLY. A real tap on a row
        // inserts nothing, focuses nothing, flashes nothing — the commands
        // teach, the composer is the only way in.
        await page.waitForFunction(() => !isChatBusy(), { timeout: 20000 });
        await page.click('[data-ca-help-row="menu"]');
        await new Promise((r) => setTimeout(r, 600));
        ok(await page.evaluate(() => {
            const inp = document.getElementById('chat-input');
            return inp.value === '' && document.activeElement !== inp;
        }), 'a real tap on a row inserts nothing into the composer and never steals the focus — the card reads only');
        // The composer wears the warm charcoal family in night mode, never
        // navy: real var() resolution, both themes (a standing criterion).
        ok(await page.evaluate(() => {
            const h = document.documentElement;
            const bar = document.querySelector('#chat-input').closest('.glass-panel');
            const read = () => getComputedStyle(bar).backgroundColor;
            const wasDark = h.classList.contains('dark');
            h.classList.remove('dark'); const light = read();
            h.classList.add('dark'); const dark = read();
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return light === 'rgba(255, 255, 255, 0.94)' && dark === 'rgba(4, 7, 15, 0.92)';
        }), 'the composer\'s glass resolves to the panel white by day and the warm charcoal by night — the navy override is gone');
        await page.evaluate(() => { document.getElementById('chat-input').value = ''; });

        console.log('— v1.48.1: the chip rail re-homes after a tap —');
        await page.waitForFunction(() => !isChatBusy(), { timeout: 20000 });
        const railProbe = await page.evaluate(async () => {
            const rail = document.getElementById('action-chips');
            const keepW = rail.style.width;
            rail.style.width = '220px';   // force the overflow deterministically at any viewport
            rail.scrollLeft = 60;
            let out = 'could not scroll the rail';
            if (rail.scrollLeft > 0) {
                document.querySelectorAll('.action-chip')[0].click();
                await new Promise((r) => setTimeout(r, 900));   // the house glide settles
                out = 'scrollLeft:' + rail.scrollLeft;
            }
            rail.style.width = keepW;
            return out;
        });
        eq(railProbe, 'scrollLeft:0', 'v1.48.1: a tapped chip glides the rail back to its home position — a real overflow, a real smooth scroll, left back at 0');
        await page.waitForFunction(() => !isChatBusy(), { timeout: 20000 });

        console.log('— v1.40.0 behaviour in the real browser —');
        // 1. A KUL transit of exactly 180 minutes (arrival 10:00, report 13:00 for a 14:00 departure) — the inclusive boundary — earns lunch.
        let txt = await (async () => { await calcCard(page, { type: 'Turnaround', t1: '1:30', t2: '1:35', lma: { iata: 'KUL', at: '10:00', dt: '14:00' } }); return resultsText(page); })();
        ok(txt.indexOf('KUL (Southeast Asia)') !== -1, 'the 3h KUL transit lists its station breakdown');
        ok(/lunch \(1x\)/i.test(txt) && txt.indexOf('$55.00') !== -1, 'the exactly-3h transit earns the $55.00 Southeast Asia lunch (inclusive boundary)');
        ok(txt.indexOf('three hours or more') !== -1, 'the overview cites the 3h rule');
        await closeResults(page);

        // 2. One minute less (departure 13:59, report 12:59 — 179 minutes) pays nothing.
        txt = await (async () => { await calcCard(page, { type: 'Turnaround', t1: '1:30', t2: '1:35', lma: { iata: 'KUL', at: '10:00', dt: '13:59' } }); return resultsText(page); })();
        ok(txt.indexOf('No location meals — the transit is under three hours.') !== -1, 'a 2h59 transit earns nothing (the honest note)');
        ok(txt.indexOf('$55.00') === -1, 'the 2h59 transit pays no lunch');
        await closeResults(page);

        // 3. Report time closes the day: departure 20:31 (report 19:31) still catches dinner; 20:29 (report 19:29) misses it.
        txt = await (async () => { await calcCard(page, { type: 'Turnaround', t1: '1:30', t2: '1:35', lma: { iata: 'KUL', at: '14:00', dt: '20:31' } }); return resultsText(page); })();
        ok(/dinner \(1x\)/i.test(txt) && txt.indexOf('$70.00') !== -1, 'a 20:31 departure reports at 19:31 — dinner is earned');
        await closeResults(page);
        txt = await (async () => { await calcCard(page, { type: 'Turnaround', t1: '1:30', t2: '1:35', lma: { iata: 'KUL', at: '14:00', dt: '20:29' } }); return resultsText(page); })();
        ok(!/dinner/i.test(txt) && txt.indexOf('$70.00') === -1, 'a 20:29 departure reports at 19:29 — the window has closed');

        // 4. v1.40.0 onboarding: the first-solo date drives the FS junior tier, per flight date.
        ok(await page.evaluate(() => { appProfile.firstSoloYMD = '2026-08-01'; return ifaRankKeyForDate('2026-10-07') === 'Jr. FS'; }), 'a first solo two months back keys the Jr. FS tier');
        ok(await page.evaluate(() => ifaRankKeyForDate('2028-08-01') === 'FS'), 'the 24-month anniversary crosses to full FS');
        ok(await page.evaluate(() => { appProfile.rank = 'LS'; return ifaRankKeyForDate('2026-10-07') === 'LS'; }), 'LS never tiers');
        await page.evaluate(() => { appProfile.rank = 'FS'; appProfile.firstSoloYMD = ''; });
        ok(await page.evaluate(() => ifaRankKeyForDate('2026-10-07') === 'FS'), 'a pre-hotfix profile with no solo date keeps the full rate');
        txt = await (async () => { await page.evaluate(() => { const t = new Date(); appProfile.firstSoloYMD = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }); await calcCard(page, { type: 'Turnaround', t1: '1:30', t2: '1:35', lma: { iata: 'KUL', at: '10:00', dt: '13:59' } }); return resultsText(page); })();
        ok(/\u00d7 \$10 \u00d7/.test(txt), 'a first solo dated yesterday prices the junior $10 tier in a real card');
        await page.evaluate(() => { appProfile.firstSoloYMD = ''; });
        await closeResults(page);

        // 4b. v1.57.0 (B3, owner-ordered): period-correct pricing in the real
        // browser — the same layover priced on its 2024 day and on a 2026 day.
        const b3Card = async (d1, d2) => {
            await page.evaluate(() => renderCalculatorCard('both'));
            await page.waitForFunction(() => !!document.querySelector('#chat-container [data-calc-card]'), { timeout: 10000 });
            await sleep(400);
            await page.evaluate((d1, d2) => {
                const card = document.querySelector('#chat-container [data-calc-card]:last-of-type');
                const id = card.querySelector('input[id$="-ifa-fn1"]').id.slice(0, -'-ifa-fn1'.length);
                const set = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
                set(document.getElementById(id + '-flight-type'), 'Layover');
                set(document.getElementById(id + '-ifa-fn1'), '3'); set(document.getElementById(id + '-ifa-fn2'), '4');
                set(document.getElementById(id + '-ifa-d1'), d1); set(document.getElementById(id + '-ifa-d2'), d2);
                set(document.getElementById(id + '-ifa-t1'), '08:00'); set(document.getElementById(id + '-ifa-t2'), '07:30');
                window.__smokeCardId = id;
            }, d1, d2);
            await sleep(300);
            await page.evaluate(() => document.getElementById(window.__smokeCardId + '-btn-calc').click());
            await sleep(400);
            return resultsText(page);
        };
        txt = await b3Card('2024-06-03', '2024-06-06');
        ok(txt.indexOf('Priced with the 2022\u20132024 agreement (CA 057/2022)') !== -1, 'B3: a 2024 duty notes the agreement that priced it');
        ok(txt.indexOf('ULR lump sums not included') !== -1, 'B3: the honest ULR skip rides the note');
        ok(txt.indexOf('$209.25') !== -1, 'B3: the 2024 layover pays the 2022 ladder ($209.25)');
        await closeResults(page);
        txt = await b3Card('2026-10-05', '2026-10-08');
        ok(txt.indexOf('Priced with') === -1, 'B3: a current-agreement duty carries no note');
        ok(txt.indexOf('$272.02') !== -1, 'B3: the same layover in 2026 pays the current ladder ($272.02)');
        await closeResults(page);

        // 5. v1.41.0: the one-shot backup round-trips in the real browser.
        ok(await page.evaluate(() => {
            localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 's1', savedAt: '2026-10-08T02:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-08', stationDisplay: 'SIN/KUL', amount: 123.45 }]));
            localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [{ ymd: '2026-10-08', kind: 'F' }] }));
            const p = buildFullBackup();
            if (p.app !== 'CrewAssist' || p.v !== 1 || p.counts.earnings !== 1 || p.counts.dutyMonths !== 1) return false;
            localStorage.removeItem('crewAssist.archive');
            localStorage.removeItem('crewAssist.dutyDays');
            applyFullBackupData(p.data);
            const arch = JSON.parse(localStorage.getItem('crewAssist.archive') || '[]');
            const duty = JSON.parse(localStorage.getItem('crewAssist.dutyDays') || '{}');
            return arch.length === 1 && arch[0].amount === 123.45 && duty['2026-10'].length === 1;
        }), 'the one-shot backup builds and restores in the real browser');
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.dutyDays'); });

        // 6. v1.42.0: the welcome-screen restore door — the new-phone journey.
        await page.evaluate(() => { localStorage.setItem('__smokeFreshBoot', '1'); localStorage.removeItem('crewAssist.profile'); });
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        ok(await page.evaluate(() => !document.getElementById('onboarding-view').classList.contains('hidden') && document.getElementById('main-view').classList.contains('hidden')), 'a profile-less boot shows the welcome screen');
        ok(await page.evaluate(() => {
            const ob = document.getElementById('ob-restore');
            const inp = document.getElementById('ob-restore-file');
            return !!ob && ob.contains(inp) && (ob.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide') === 'log-in';
        }), 'the welcome screen carries the restore door');
        ok(await page.evaluate(() => { const r = document.getElementById('ob-restore').getBoundingClientRect(); return r.width > 0 && Math.abs(r.width - r.height) < 1.5; }), 'hotfix: the login door renders square (the compiled stylesheet carries the square)');
        await page.evaluate(() => {
            localStorage.setItem('crewAssist.archive', JSON.stringify([{ id: 'w1', savedAt: '2026-10-08T03:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-08', stationDisplay: 'SIN/BKK', amount: 88 }]));
            localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [{ ymd: '2026-10-09', kind: 'F' }] }));
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Welcome Wo', gender: 'M', rank: 'FS' }));
            const p = buildFullBackup();
            ['crewAssist.profile', 'crewAssist.archive', 'crewAssist.dutyDays'].forEach((k) => localStorage.removeItem(k));
            window.__welcomePayload = JSON.stringify(p);
        });
        await page.evaluate(() => backupRestoreRead('crewassist-backup.json', window.__welcomePayload, { fromOnboarding: true }));
        await page.waitForFunction(() => !document.getElementById('app-dialog-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => { const m = document.getElementById('app-dialog-msg').textContent; return m.indexOf('Welcome Wo') !== -1 && m.indexOf('1 earnings entries') !== -1; }), 'the welcome door previews the backup before touching the phone');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }),
            page.evaluate(() => document.getElementById('app-dialog-ok').click()),
        ]);
        ok(await page.evaluate(() => document.getElementById('onboarding-view').classList.contains('hidden') && !document.getElementById('main-view').classList.contains('hidden')), 'the restore reloads straight past onboarding into the app');
        ok(await page.evaluate(() => {
            const arch = JSON.parse(localStorage.getItem('crewAssist.archive') || '[]');
            const prof = JSON.parse(localStorage.getItem('crewAssist.profile') || 'null');
            const duty = JSON.parse(localStorage.getItem('crewAssist.dutyDays') || '{}');
            return arch.length === 1 && arch[0].amount === 88 && prof && prof.name === 'Welcome Wo' && duty['2026-10'] && duty['2026-10'].length === 1;
        }), 'the restored phone carries the earnings, profile and duty days');
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.spotMainDone') === '1' && JSON.parse(localStorage.getItem('crewAssist.spotDone') || '{}').main === '1.53.2'), 'hotfix: a restoring user is not offered the tour — the legacy mirror AND the per-walk store both land (v1.50.0; the store rides main\u2019s current cv, 1.53.2 since the rewritten closer)');
        // owner ruling 2026-10-08 (round 11): leave the What's New re-offer
        // as is — it returns on every launch until the crew ticks
        // "Do not show again"; closing alone never counts as seen
        ok(await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }), "a restored phone re-offers What's New (owner ruling: it returns until Do-not-show-again)");
        await page.evaluate(() => document.getElementById('whatsnew-close').click());
        await sleep(400);
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        ok(await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }), 'merely closing never counts as seen — the next boot re-offers (the v1.35.0 ruling)');
        await page.evaluate(() => { document.getElementById('whatsnew-hide').checked = true; document.getElementById('whatsnew-close').click(); });
        await sleep(400);
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        ok(await page.evaluate(() => document.getElementById('whatsnew-backdrop').classList.contains('hidden')), 'Do-not-show-again is the only seen stamp — the boot after stays quiet');
        // a partial export through the welcome door redirects honestly
        await page.evaluate(() => backupRestoreRead('earnings.json', JSON.stringify([{ id: 'w2', savedAt: '2026-10-08T04:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-08', stationDisplay: 'SIN/HKT', amount: 5 }]), { fromOnboarding: true }));
        await page.waitForFunction(() => !document.getElementById('app-dialog-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => document.getElementById('app-dialog-msg').textContent.indexOf('earnings export') !== -1), 'the welcome door refuses partial exports with directions');
        await page.evaluate(() => document.getElementById('app-dialog-ok').click());

        // 7. hotfix: the standard widths actually render (compiled stylesheet).
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => {
            const wd = (el) => el.getBoundingClientRect().width;
            const tg = wd(document.querySelector('a[href="https://t.me/harlequinzxc"]'));
            return ['btn-edit-profile', 'btn-changelog'].every((id) => Math.abs(wd(document.getElementById(id)) - tg) < 1.5);
        }), 'hotfix: Edit, View and Telegram render one width (the compiled stylesheet carries w-32)');
        await page.evaluate(() => closeSettings());

        // 7b. v1.49.0 (owner order): the spotlight tours in the real browser —
        // the eight Settings rows, the veil that shows without letting go,
        // and the tooltip that never clips the viewport (the iPhone 11
        // lesson, pinned with real Chromium geometry).
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        // the sheet slides in over ~300ms — a real tap waits for it to settle
        await page.waitForFunction(() => !document.getElementById('settings-sheet').classList.contains('translate-y-full'), { timeout: 5000 });
        await sleep(350);
        ok(await page.evaluate(() => [...document.querySelectorAll('#ca-feature-tours [data-ca-spot]')].map((r) => r.getAttribute('data-ca-spot')).join(',') === 'main,roster,manual,menus,earnings,calendar,stats,backup'), 'Settings carries the eight Feature Tour rows in the owner\u2019s order');
        // v1.50.0: wipe the FULL completion state (the store, the legacy
        // mirror, the decline) — the rows must read hollow before the walk
        await page.evaluate(() => { localStorage.removeItem('crewAssist.spotMainDone'); localStorage.removeItem('crewAssist.spotDone'); localStorage.removeItem('crewAssist.spotMainDeclined'); });
        // the rows sync at boot and at every walk's end — re-sync explicitly
        // after clearing, exactly as the next boot would read the store
        await page.evaluate(() => caSpotSyncRowIcons());
        ok(await page.evaluate(() => [...document.querySelectorAll('#ca-feature-tours [data-ca-spot]')].every((r) => r.querySelector('.ca-spot-row-status') && r.querySelector('.ca-spot-row-status').getAttribute('data-lucide') === 'circle')), 'v1.50.0: with nothing done, all eight rows read hollow circles (the rig\'s icon stub keeps the element, so the intent is assertable)');
        // the one-time PWA install hint can sit over a returning device —
        // a real user reads it, taps OK, then tours
        await page.evaluate(() => { const b = document.getElementById('app-dialog-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('app-dialog-ok').click(); });
        await sleep(350);
        // v1.53.1: the fold sections start CLOSED — open the Feature
        // tour fold the way the crew would, then tap its row
        await page.click('[data-accordion-target="ca-acc-ft"]');
        await sleep(450);
        await page.evaluate(() => document.querySelector('#ca-feature-tours [data-ca-spot="main"]').scrollIntoView({ block: 'center' }));
        await sleep(150);
        await page.click('#ca-feature-tours [data-ca-spot="main"]');
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-spot-on'), { timeout: 5000 });
        // closeSettings arms the backdrop's 300ms hide — wait it out
        await page.waitForFunction(() => document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => document.getElementById('settings-backdrop').classList.contains('hidden')), 'the main-screen tour closes Settings first (the owner\u2019s order)');
        await page.waitForFunction(() => document.getElementById('ca-spot-tip').textContent.indexOf('1 of 8') !== -1, { timeout: 5000 });
        ok(await page.evaluate(() => { const b = document.querySelectorAll('#ca-spot-tip b'); return b.length === 1 && b[0].textContent === 'At Your Service'; }), 'v1.49.2: the bold marker rides the TITLE now (title case since v1.49.3) — one bold phrase, rendered bold in the real browser');
        // v1.49.2: the ring GLIDES again (owner order) — its inline style IS
        // its destination. Every wait is CDP-polled from the rig
        // (waitForFunction), never an in-page interval: this deep into the
        // suite the page's own timers can be throttled to a crawl, and an
        // in-page interval cap can never fire to release its own wait (the
        // 180s protocol hang this round taught it).
        const geo = [];
        for (let i = 0; i < 8; i++) {
            const ready = await page.waitForFunction(() => {
                const tip = document.getElementById('ca-spot-tip');
                const on = document.documentElement.classList.contains('ca-spot-on');
                return !on || !!(tip && /\d+ of \d/.test(tip.textContent));
            }, { timeout: 8000, polling: 150 }).then(() => true).catch(() => false);
            if (!ready) break;
            const live = await page.evaluate(() => {
                const on = document.documentElement.classList.contains('ca-spot-on');
                const tip = document.getElementById('ca-spot-tip');
                return on && !!(tip && /\d+ of \d/.test(tip.textContent));
            });
            if (!live) break;   // the walk stood down (Done) — no phantom step
            await sleep(500);   // past the 350ms deferred re-assert's re-place
            await page.waitForFunction(() => {
                const r = document.getElementById('ca-spot-ring');
                if (!r) return false;
                const b = r.getBoundingClientRect();
                const fx = parseFloat(r.style.left), fy = parseFloat(r.style.top), fw = parseFloat(r.style.width), fh = parseFloat(r.style.height);
                return [fx, fy, fw, fh].every((v) => isFinite(v)) &&
                    Math.abs(b.left - fx) <= 0.5 && Math.abs(b.top - fy) <= 0.5 && Math.abs(b.width - fw) <= 0.5 && Math.abs(b.height - fh) <= 0.5;
            }, { timeout: 5000, polling: 100 }).catch(() => {});
            const m = await page.evaluate(() => {
                const tip = document.getElementById('ca-spot-tip');
                const tr = tip.getBoundingClientRect();
                const rr = document.getElementById('ca-spot-ring').getBoundingClientRect();
                return {
                    counter: (tip.textContent.match(/\d+ of 8/) || [''])[0],
                    w: tr.width,
                    inView: tr.left >= 11.5 && tr.top >= 11.5 && tr.right <= window.innerWidth - 11.5 && tr.bottom <= window.innerHeight - 11.5,
                    ringInView: rr.left >= 0.5 && rr.top >= 0.5 && rr.right <= window.innerWidth - 0.5 && rr.bottom <= window.innerHeight - 0.5,
                    noCover: tr.top >= rr.bottom - 0.5 || tr.bottom <= rr.top + 0.5,
                    ringSize: rr.width > 0 && rr.height > 0,
                    hasNext: !!document.getElementById('ca-spot-next')
                };
            });
            geo.push(Object.assign({ i }, m));
            const clicked = await page.evaluate(() => { const n = document.getElementById('ca-spot-next'); if (n) n.click(); return !!n; });
            if (!clicked) break;
        }
        ok(geo.length === 8, 'the walk covers all eight steps (v1.53.0: the closer lights the Feature tour section)');
        ok(geo.every((s) => s.counter === (s.i + 1) + ' of 8'), 'the counter advances 1..8 of 8 in the real browser');
        ok(geo.every((s) => s.inView), 'the tooltip never clips the viewport at any step — 12px margins hold (the iPhone 11 lesson)');
        ok(geo.every((s) => s.w <= 300.5), 'the tooltip stays capped at 300px');
        ok(geo.every((s) => s.ringSize), 'the ring sizes to a real target at every step');
        ok(geo.every((s) => s.ringInView), 'the lit target sits fully inside the viewport at every step (the owner\u2019s v1.49.1 order; header-flush targets may kiss the edge)');
        ok(geo.every((s) => s.noCover), 'the tooltip never covers the lit target');
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-spot-on')), 'Done stands the tour down');
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.spotMainDone') === '1'), 'Done on the main tour keeps the legacy mirror stamped');
        ok(await page.evaluate(() => JSON.parse(localStorage.getItem('crewAssist.spotDone') || '{}').main === '1.53.2'), 'v1.50.0: Done stamps the per-walk store at main\u2019s current cv (1.53.2 since the rewritten closer)');
        ok(await page.evaluate(() => { const i = document.querySelector('#ca-feature-tours [data-ca-spot="main"] .ca-spot-row-status'); return i && i.getAttribute('data-lucide') === 'circle-check' && i.className.indexOf('text-sia-gold') !== -1; }), 'v1.50.0: the main row flips to the gold circle-check at Done');
        // v1.58.0 (owner order): the main walk's Done CLOSES the Settings
        // sheet — the crew lands on the chat screen, never inside the sheet
        await page.waitForFunction(() => document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 }).catch(() => {});
        ok(await page.evaluate(() => document.getElementById('settings-backdrop').classList.contains('hidden')), 'v1.58.0: the main walk\u2019s Done closes Settings behind it — the closer sends the crew home, whatever path started the walk');

        // v1.53.0 + v1.53.1 (owner order): the Settings accordions — the
        // four quieter sections (Feature tour, Developer Mode, Storage,
        // Data Management) fold behind their headers and START FOLDED.
        // Computed geometry in real Chromium: the grid-rows ride lays the
        // body at real pixel height when open and 0px when folded, the
        // chevron rotates, the fold state never touches localStorage —
        // and a walk's Settings world opens the folds while the stage
        // revert hands the crew's own fold state home.
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(600);
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-sheet').classList.contains('translate-y-full'), { timeout: 5000 });
        await sleep(350);
        ok(await page.evaluate(() => document.querySelectorAll('.ca-acc').length === 4 && document.querySelectorAll('[data-accordion-target]').length === 4), 'v1.53.0: exactly four fold sections, four data-accordion-target heads');
        ok(await page.evaluate(() => [...document.querySelectorAll('[data-accordion-target]')].every((b) => b.getAttribute('aria-expanded') === 'false')), 'v1.53.1 (owner order): every fold starts CLOSED, announced through aria-expanded');
        ok(await page.evaluate(() => [...document.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed'))), 'v1.53.1: every fold section carries the closed class at rest');
        const foldRest = await page.evaluate(() => ({
            rows: getComputedStyle(document.getElementById('ca-acc-ft')).gridTemplateRows,
            bodyH: document.getElementById('ca-acc-ft').getBoundingClientRect().height,
            secH: document.getElementById('ca-ft-section').getBoundingClientRect().height,
            chev: getComputedStyle(document.querySelector('#ca-ft-section .ca-acc-chev')).transform,
            keys: Object.keys(localStorage).length
        }));
        ok(foldRest.rows === '0px', 'the resting fold rides grid-template-rows at 0px — the smooth height fold, computed');
        ok(foldRest.bodyH < 1, 'the resting BODY collapses to zero height');
        ok(foldRest.secH > 10 && foldRest.secH < 80, 'the resting section is just its label row — the head stays tappable');
        ok(foldRest.chev === 'matrix(0, -1, 1, 0, 0, 0)', 'the resting chevron sits rotated -90deg');
        await page.click('[data-accordion-target="ca-acc-ft"]');
        await sleep(450);   // past the .28s fold ride
        const foldOpen = await page.evaluate(() => ({
            rows: getComputedStyle(document.getElementById('ca-acc-ft')).gridTemplateRows,
            chev: getComputedStyle(document.querySelector('#ca-ft-section .ca-acc-chev')).transform,
            aria: document.querySelector('[data-accordion-target="ca-acc-ft"]').getAttribute('aria-expanded'),
            keys: Object.keys(localStorage).length
        }));
        ok(parseFloat(foldOpen.rows) > 100, 'one tap lays the body at full height — computed grid-template-rows resolves to real pixels');
        ok(foldOpen.chev === 'none' || foldOpen.chev === 'matrix(1, 0, 0, 1, 0, 0)', 'the opened chevron sits unrotated');
        ok(foldOpen.aria === 'true', 'the head announces the open through aria-expanded');
        ok(foldOpen.keys === foldRest.keys, 'the fold state never touches localStorage — in memory only, a reload folds everything again');
        // the world and the stage revert: the DM section sits folded (the
        // v1.53.1 default), the crew taps the backup row from the OPEN
        // Feature tour fold — the walk's Settings world opens the DM fold
        // to light it, and Skip hands the crew's own fold state home
        ok(await page.evaluate(() => document.getElementById('ca-dm-section').classList.contains('ca-acc-closed')), 'the DM section sits folded before the tap (the default)');
        await page.evaluate(() => { document.querySelector('#ca-feature-tours [data-ca-spot="backup"]').scrollIntoView({ block: 'center' }); });
        await sleep(150);
        await page.click('#ca-feature-tours [data-ca-spot="backup"]');
        await page.waitForFunction(() => document.getElementById('ca-spot-tip').textContent.indexOf('Your Data, Your File') !== -1, { timeout: 8000 });
        ok(await page.evaluate(() => !document.getElementById('ca-dm-section').classList.contains('ca-acc-closed')), 'v1.53.0: the walk\u2019s Settings world OPENED the fold to light it — a fold can never hide a lit target');
        await page.click('#ca-spot-skip');
        await sleep(500);
        ok(await page.evaluate(() => document.getElementById('ca-dm-section').classList.contains('ca-acc-closed')), 'v1.53.0: the stage revert re-folds the section the crew had folded (the default state)');
        ok(await page.evaluate(() => !document.getElementById('ca-ft-section').classList.contains('ca-acc-closed')), 'the fold the crew tapped open rides home open');
        ok(await page.evaluate(() => !document.getElementById('settings-backdrop').classList.contains('hidden')), 'the pre-tap stage holds — Settings stays open after the skip');
        await page.evaluate(() => { caAccOpenAll(); closeSettings(); });
        await sleep(500);
        // v1.58.0 (owner order): the folds never survive a close — the
        // sheet above left every section OPEN; the reopen must find them
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-sheet').classList.contains('translate-y-full'), { timeout: 5000 });
        await sleep(350);
        ok(await page.evaluate(() => [...document.querySelectorAll('.ca-acc')].every((el) => el.classList.contains('ca-acc-closed'))), 'v1.58.0: the reopen finds every fold collapsed — however they were left');
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('ca-acc-ft')).gridTemplateRows === '0px'), 'v1.58.0: the reopened fold body rides grid-template-rows at 0px — the close reset is real geometry, not a class alone');
        await page.evaluate(() => closeSettings());
        await sleep(500);

        // v1.49.1 (owner order): ALL highlighted content fits the viewport —
        // every step of every remaining walk carries the ring-in-view and
        // the tooltip-covers-nothing pins, computed in real Chromium.
        // v1.52.0: the menus walk's button step runs the app's own fetch —
        // the rig's /api/sq 404s, so the app's own saved-schedule fallback
        // renders the card (the cabin schedule seeded here once; the origin
        // keeps it across the per-walk reloads). The recents sentinel rides
        // the stage-revert pin at the menus walk's end.
        await page.evaluate(() => {
            const t = new Date(); const off = t.getTimezoneOffset() * 60000;
            const ymd = (new Date(t.getTime() - off)).toISOString().split('T')[0];
            localStorage.setItem('SQ802:' + ymd + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, aircraftType: '787', cabinClasses: ['JCL', 'YCL'], legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'HND' } }] } }));
            localStorage.setItem('crewAssist.recentFlights', JSON.stringify([{ flight: '736', date: '2026-01-05' }]));
        });
        // v1.52.0: menus splits its form and button steps (4), stats and
        // backup trim to four
        const walks = [['roster', 6], ['manual', 4], ['menus', 4], ['earnings', 5], ['calendar', 6], ['stats', 4], ['backup', 4]];
        for (const w of walks) {
            const tid = w[0], n = w[1];
            // each walk starts from a CLEAN stage — v1.50.0 reverts every
            // walk's stage at its end, and the reload belts-and-braces it
            await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
            await sleep(600);
            await page.evaluate(() => openSettings());
            await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
            await page.waitForFunction(() => !document.getElementById('settings-sheet').classList.contains('translate-y-full'), { timeout: 5000 });
            await sleep(350);
            await page.evaluate(() => { const b = document.getElementById('app-dialog-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('app-dialog-ok').click(); });
            await sleep(250);
            // v1.53.1: the fold starts closed — open it before the row tap
            await page.click('[data-accordion-target="ca-acc-ft"]');
            await sleep(450);
            await page.evaluate((t) => document.querySelector('#ca-feature-tours [data-ca-spot="' + t + '"]').scrollIntoView({ block: 'center' }), tid);
            await sleep(150);
            await page.click('#ca-feature-tours [data-ca-spot="' + tid + '"]');
            await page.waitForFunction(() => document.documentElement.classList.contains('ca-spot-on'), { timeout: 5000 });
            // v1.49.2: CDP-polled waits only (the page's own timers can be
            // throttled this deep into the suite — an in-page interval cap
            // then never fires to release its own wait).
            const g = [];
            for (let i = 0; i < n; i++) {
                const ready = await page.waitForFunction(() => {
                    const tip = document.getElementById('ca-spot-tip');
                    const on = document.documentElement.classList.contains('ca-spot-on');
                    return !on || !!(tip && /\d+ of \d/.test(tip.textContent));
                }, { timeout: 8000, polling: 150 }).then(() => true).catch(() => false);
                if (!ready) break;
                const live = await page.evaluate(() => {
                    const on = document.documentElement.classList.contains('ca-spot-on');
                    const tip = document.getElementById('ca-spot-tip');
                    return on && !!(tip && /\d+ of \d/.test(tip.textContent));
                });
                if (!live) break;   // the walk stood down (Done) — no phantom step
                await sleep(500);   // past the 350ms deferred re-assert
                await page.waitForFunction(() => {
                    const r = document.getElementById('ca-spot-ring');
                    if (!r) return false;
                    const b = r.getBoundingClientRect();
                    const fx = parseFloat(r.style.left), fy = parseFloat(r.style.top), fw = parseFloat(r.style.width), fh = parseFloat(r.style.height);
                    return [fx, fy, fw, fh].every((v) => isFinite(v)) &&
                        Math.abs(b.left - fx) <= 0.5 && Math.abs(b.top - fy) <= 0.5 && Math.abs(b.width - fw) <= 0.5 && Math.abs(b.height - fh) <= 0.5;
                }, { timeout: 5000, polling: 100 }).catch(() => {});
                const m = await page.evaluate((n) => {
                    const tip = document.getElementById('ca-spot-tip');
                    const tr = tip.getBoundingClientRect();
                    const rr = document.getElementById('ca-spot-ring').getBoundingClientRect();
                    const mm = tip.textContent.match(new RegExp('(\\d+) of ' + n));
                    return {
                        counter: mm ? Number(mm[1]) : 0,
                        inView: tr.left >= 11.5 && tr.top >= 11.5 && tr.right <= window.innerWidth - 11.5 && tr.bottom <= window.innerHeight - 11.5,
                        ringInView: rr.left >= 0.5 && rr.top >= 0.5 && rr.right <= window.innerWidth - 0.5 && rr.bottom <= window.innerHeight - 0.5,
                        noCover: tr.top >= rr.bottom - 0.5 || tr.bottom <= rr.top + 0.5,
                        ringSize: rr.width > 0 && rr.height > 0,
                        hasNext: !!document.getElementById('ca-spot-next')
                    };
                }, n);
                g.push(m);
                if (tid === 'calendar' && m.counter === 1) {
                    ok(await page.evaluate(() => {
                        const r = document.getElementById('ca-spot-ring').getBoundingClientRect();
                        const h = document.getElementById('ca-rc-head').getBoundingClientRect();
                        const g2 = document.getElementById('ca-rc-grid').getBoundingClientRect();
                        return r.left <= h.left + 0.5 && r.top <= h.top + 0.5 && r.right >= g2.right - 0.5 && r.bottom >= g2.bottom - 0.5;
                    }), 'v1.52.0: calendar step 1' + String.fromCharCode(8217) + 's ring wraps the month header AND the calendar grid — the union target, measured');
                }
                const clicked = await page.evaluate(() => { const nx = document.getElementById('ca-spot-next'); if (nx) nx.click(); return !!nx; });
                if (!clicked) break;
            }
            ok(g.length >= 1, 'the ' + tid + ' walk shows its steps in the real browser');
            const cs = g.map((x) => x.counter);
            ok(cs.every((c, i) => c >= 1 && c <= n && (i === 0 || c > cs[i - 1])), 'the ' + tid + ' counters advance within 1..' + n + ' (a vanished step skips itself, carrying its number) \u2014 saw [' + cs.join(',') + ']');
            ok(g.every((x) => x.inView), 'the ' + tid + ' tooltip never clips the viewport at any step');
            ok(g.every((x) => x.ringInView), 'the ' + tid + ' lit target sits fully inside the viewport at every step');
            ok(g.every((x) => x.noCover), 'the ' + tid + ' tooltip never covers the lit target');
            ok(g.every((x) => x.ringSize), 'the ' + tid + ' ring sizes to a real target at every step');
            ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-spot-on')), 'the ' + tid + ' walk stands down at Done');
            // v1.50.0 (owner order): the walk's stage reverts — the sheet it
            // opened closes behind it, and Settings (open at every row-start)
            // restores open
            await page.waitForFunction(() => document.getElementById('ca-arch-backdrop').classList.contains('hidden') && document.getElementById('ca-roster-cal').classList.contains('hidden') && document.getElementById('ca-rc-podwrap').classList.contains('hidden') && document.getElementById('ca-rc-statwrap').classList.contains('hidden') && document.getElementById('menu-backdrop').classList.contains('hidden'), { timeout: 5000 }).catch(() => {});
            ok(await page.evaluate(() => document.getElementById('ca-arch-backdrop').classList.contains('hidden') && document.getElementById('ca-roster-cal').classList.contains('hidden') && document.getElementById('ca-rc-podwrap').classList.contains('hidden') && document.getElementById('ca-rc-statwrap').classList.contains('hidden') && document.getElementById('menu-backdrop').classList.contains('hidden')), 'v1.50.0: the ' + tid + ' walk\u2019s own sheet closes behind it — the stage reverts (the records page with it)');
            ok(await page.evaluate(() => !document.getElementById('settings-backdrop').classList.contains('hidden')), 'v1.50.0: Settings restores OPEN after the ' + tid + ' walk — it was open at the row-tap');
            if (tid === 'roster') ok(await page.evaluate(() => document.getElementById('action-chips').scrollLeft === 0), 'v1.51.0 (owner report): the roster walk\u2019s chip step scrolls the rail right — and the stage revert carries it home, never stranded mid-row');
            if (tid === 'manual') ok(await page.evaluate(() => !document.querySelector('#chat-container [id^="calc-"]')), 'v1.49.2 (owner order): the manual walk\u2019s calculator card leaves with the veil — the chat reverts to its pre-tour state');
            if (tid === 'menus') ok(await page.evaluate(() => {
                const t = new Date(); const off = t.getTimezoneOffset() * 60000;
                const ymd = (new Date(t.getTime() - off)).toISOString().split('T')[0];
                return localStorage.getItem('crewAssist.recentFlights') === JSON.stringify([{ flight: '736', date: '2026-01-05' }]) && !!localStorage.getItem('SQ802:' + ymd + ':CABINS') && !document.querySelector('#chat-container [id^="fv-flight-"]');
            }), 'v1.52.0: the menus walk' + String.fromCharCode(8217) + 's fetch prop leaves no trace — the recents list and cabin caches ride home with the stage, the card with the veil');
        }

        // v1.49.1 (owner order, v1.50.0 prompt-first): the firing doors in
        // the real browser — the INVITATION renders at the chat screen
        // BEFORE the What's-New sheet, for every crew who never finished
        // this content of the main walk; Next walks, Skip (or Escape)
        // declines forever; Done alone retires it; the sheet and the
        // greeting wait behind.
        await page.evaluate(() => { localStorage.removeItem('crewAssist.spotMainDone'); localStorage.removeItem('crewAssist.spotDone'); localStorage.removeItem('crewAssist.spotMainDeclined'); localStorage.removeItem('crewAssist.hideWhatsNew'); localStorage.setItem('crewAssist.wnSeen', '1.48.5'); });
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForFunction(() => !!document.getElementById('ca-spot-prompt-backdrop'), { timeout: 20000 });
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-spot-on')), 'the invitation gates the walk — the veil stays down until Next');
        ok(await page.evaluate(() => document.getElementById('whatsnew-backdrop').classList.contains('hidden')), 'the invitation renders BEFORE the What\u2019s-New sheet — the sheet waits behind it');
        ok(await page.evaluate(() => (document.getElementById('chat-container').innerText || '').trim() === ''), 'the greeting waits behind the invitation too — the chat is still empty');
        // the card itself: copy verbatim, the compass, the focus, the trap
        ok(await page.evaluate(() => document.getElementById('ca-spot-prompt-backdrop').textContent.indexOf('Let\u2019s take a quick tour') !== -1 && document.getElementById('ca-spot-prompt-card').textContent.indexOf('Eight quick steps in under a minute') !== -1), 'v1.50.0: the invitation reads its copy verbatim — headline and secondary (v1.53.0: eight)');
        ok(await page.evaluate(() => { const p = document.querySelector('#ca-spot-prompt-card svg polygon'); return !!p && p.getAttribute('points') === '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76'; }), 'v1.50.0: the invitation carries the Lucide compass, polygon exact');
        ok(await page.evaluate(() => document.getElementById('ca-spot-prompt-next').textContent === 'Next' && document.getElementById('ca-spot-prompt-skip').textContent === 'Skip'), 'the invitation buttons read Next and Skip');
        ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ca-spot-prompt-next'), 'Next takes focus when the invitation opens');
        await page.keyboard.press('Tab');
        ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ca-spot-prompt-skip'), 'Tab moves focus to Skip — trapped inside the card');
        await page.keyboard.press('Tab');
        ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ca-spot-prompt-next'), 'Tab cycles back to Next — the trap holds');
        // the fade-in runs (and reduced motion never gates it — the owner's
        // tour-animation exemption)
        await page.waitForFunction(() => document.getElementById('ca-spot-prompt-backdrop').classList.contains('ca-prompt-in'), { timeout: 5000 });
        ok(await page.evaluate(() => { const bd = document.getElementById('ca-spot-prompt-backdrop'); const cs = getComputedStyle(bd); return cs.opacity === '1' && cs.transitionDuration === '0.28s'; }), 'v1.50.0: the invitation fades in over .28s — and no ca-reduced rule gates it');
        // Escape declines: permanent, no completion, the stage moves on
        await page.keyboard.press('Escape');
        // the teardown's synchronous marks land with the keypress; the node
        // itself leaves after the 300ms fade — a page timer this deep into
        // the suite can crawl, so the wait takes the marks OR the absence
        await page.waitForFunction(() => { const b = document.getElementById('ca-spot-prompt-backdrop'); return !b || (b.classList.contains('ca-prompt-out') && b.style.pointerEvents === 'none'); }, { timeout: 5000 });
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.spotMainDeclined') === '1' && localStorage.getItem('crewAssist.spotDone') === null), 'Escape declines the invitation — permanently, completing nothing');
        await page.waitForFunction(() => !document.getElementById('ca-spot-prompt-backdrop'), { timeout: 15000 });
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        ok(true, 'the decline hands the stage to the What\u2019s-New sheet');
        await page.click('#whatsnew-close');
        await page.waitForFunction(() => (document.getElementById('chat-container').innerText || '').trim().length > 0, { timeout: 20000 });
        ok(true, 'the greeting types once the sheet closes');
        // a declined device never sees the invitation again — the row stays
        // one tap away, and the walk itself never auto-fires
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(1500);
        ok(await page.evaluate(() => !document.getElementById('ca-spot-prompt-backdrop') && !document.documentElement.classList.contains('ca-spot-on')), 'a declined device never sees the invitation again — and no walk fires');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        await page.click('#whatsnew-close');
        await sleep(300);
        // un-decline: the invitation returns, and Next walks
        await page.evaluate(() => localStorage.removeItem('crewAssist.spotMainDeclined'));
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForFunction(() => !!document.getElementById('ca-spot-prompt-backdrop'), { timeout: 20000 });
        await page.click('#ca-spot-prompt-next');
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-spot-on'), { timeout: 20000 });
        await page.waitForFunction(() => !document.getElementById('ca-spot-prompt-backdrop'), { timeout: 15000 }).catch(() => {});
        ok(await page.waitForFunction(() => document.getElementById('ca-spot-tip').textContent.indexOf('1 of 8') !== -1, { timeout: 10000 }), 'Next starts the walk — the spotlight opens on the chat bar');
        ok(await page.evaluate(() => (document.getElementById('chat-container').innerText || '').trim() === ''), 'the greeting still waits behind the walk');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.documentElement.classList.contains('ca-spot-on'), { timeout: 5000 });
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.spotMainDone') === null && localStorage.getItem('crewAssist.spotDone') === null && localStorage.getItem('crewAssist.spotMainDeclined') === null), 'Escape on the WALK is neither completion nor decline — all three keys stay unstamped');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        await page.click('#whatsnew-close');
        await sleep(300);
        // a skipped walk returns on the next open (the invitation re-fires);
        // carried to Done, it retires
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForFunction(() => !!document.getElementById('ca-spot-prompt-backdrop'), { timeout: 20000 });
        ok(true, 'the invitation returns on the next open after a skipped walk');
        await page.click('#ca-spot-prompt-next');
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-spot-on'), { timeout: 20000 });
        await page.waitForFunction(() => !document.getElementById('ca-spot-prompt-backdrop'), { timeout: 15000 }).catch(() => {});
        ok(await page.waitForFunction(() => document.getElementById('ca-spot-tip').textContent.indexOf('1 of 8') !== -1, { timeout: 10000 }), 'the walk returns on the next open after a skip');
        // v1.49.2: CDP-driven stepping (in-page timer waits can throttle to
        // a crawl deep into the suite — same lesson as the geo loops)
        for (let i = 0; i < 8; i++) {
            await page.waitForFunction(() => {
                const on = document.documentElement.classList.contains('ca-spot-on');
                const tip = document.getElementById('ca-spot-tip');
                return !on || !!(tip && /\d+ of \d/.test(tip.textContent));
            }, { timeout: 8000, polling: 150 }).catch(() => {});
            const live = await page.evaluate(() => {
                const on = document.documentElement.classList.contains('ca-spot-on');
                const tip = document.getElementById('ca-spot-tip');
                return on && !!(tip && /\d+ of \d/.test(tip.textContent));
            });
            if (!live) break;
            const clicked = await page.evaluate(() => { const nx = document.getElementById('ca-spot-next'); if (nx) nx.click(); return !!nx; });
            if (!clicked) break;
            await sleep(150);
        }
        await page.waitForFunction(() => !document.documentElement.classList.contains('ca-spot-on'), { timeout: 5000 });
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.spotMainDone') === '1' && JSON.parse(localStorage.getItem('crewAssist.spotDone') || '{}').main === '1.53.2'), 'ONLY Done completes — the mirror and the per-walk store both land');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        await page.click('#whatsnew-close');
        await sleep(300);
        // stamped now: the next open is quiet (the sheet still returns per the v1.35.0 ruling)
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(1500);
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-spot-on') && !document.getElementById('ca-spot-prompt-backdrop')), 'a completed walk never fires again on its own — the invitation stays down too (the store reads done)');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        await page.click('#whatsnew-close');
        await sleep(300);
        // leave the device quiet for the sections below (the do-not-show door)
        await page.evaluate(() => { localStorage.setItem('crewAssist.hideWhatsNew', '1.52.0'); localStorage.setItem('crewAssist.wnSeen', '1.52.0'); });

        // 7c. v1.45.34 (owner order): the changelog filter chips in the real
        // browser - the compact three-tier framework, and the painted fade.
        await page.evaluate(() => openChangelog());
        await page.waitForFunction(() => { const b = document.getElementById('ca-changelog-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 5000 });
        ok(await page.evaluate(() => [...document.querySelectorAll('#ca-cl-chips .ca-cl-chip')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'All|New|Fixes|Polish'), 'v1.45.34: the filter tokens read All / New / Fixes / Polish - the compact three-tier framework');
        ok(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('ca-cl-chips')); const m = cs.maskImage || cs.webkitMaskImage; return /linear-gradient\(to right, (?:rgba\(0, 0, 0, 0\)|transparent), (?:rgb\(0, 0, 0\)|black) 24px,/.test(m); }), 'v1.45.34: the chips rail fades at both edges - the 24px gradient mask paints on the scroll boundary, never on the hit targets (Chromium re-serializes the colors through the CSSOM)');
        ok(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('action-chips')); const m = cs.maskImage || cs.webkitMaskImage; return /linear-gradient\(to right, (?:rgba\(0, 0, 0, 0\)|transparent), (?:rgb\(0, 0, 0\)|black) 24px,/.test(m); }), 'v1.45.36: the chat\u2019s quick-action rail wears the SAME both-edge fade - one shared class, one visual language (computed in the real browser)');
        ok(await page.evaluate(() => { const v = document.querySelector('.ca-input-veil'); if (!v) return false; const cs = getComputedStyle(v); const wrap = v.parentElement.getBoundingClientRect(); const vr = v.getBoundingClientRect(); return cs.position === 'absolute' && cs.top === '92px' && Math.abs((vr.top - wrap.top) - 92) < 1 && cs.backgroundImage.indexOf('linear-gradient') === 0; }), 'v1.45.36: the veil is pinned at the chips\u2019 bottom edge (92px below the input wrapper\u2019s top) - the painted dark overlay no longer covers the chip zone, and the wrapper-growth math keeps the seam on the chips at every composer height');
        // v1.48.2 (owner order): the chip rail sits slightly DOWN — closer to
        // the typing field — and press-and-hold highlights nothing anywhere
        // except the typing fields. Computed here because jsdom cannot
        // resolve stylesheet-class styles.
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('action-chips').parentElement).rowGap === '6px'), 'v1.48.2: the chips sit 6px closer to the composer — gap-1.5, not gap-3 (computed rowGap on the input column)');
        ok(await page.evaluate(() => {
            const b = getComputedStyle(document.body);
            const inp = getComputedStyle(document.getElementById('chat-input'));
            const bubble = document.getElementById('chat-container');
            return b.userSelect === 'none' && b.webkitUserSelect === 'none' && inp.userSelect === 'text' && (!bubble || getComputedStyle(bubble).userSelect === 'none');
        }), 'v1.48.2: the body bans selection outright (user-select and -webkit-user-select none) while the chat input keeps its text — the typing fields are the one exception');
        ok(await page.evaluate(() => { const t = document.querySelector('#ca-changelog-list .ca-cl-tag-imp'); return !!t && t.textContent.trim() === 'POLISH'; }), 'v1.45.36: the imp badge reads POLISH in the rendered rows - chip, label and badge all speak the same token');
        await page.evaluate(() => document.getElementById('ca-changelog-close').click());
        await sleep(400);
        // the layer's few seconds once shifted the 7b seam into the welcome
        // cadence's typing windows (a leftover bubble tripped the reduced-
        // motion pin and the tap behind it). chat-busy is continuous across
        // the whole bot queue - it only clears when the queue drains - so
        // one idle wait here hands 7b the drained chat it always had (the
        // rig's own restored-phone precedent, before the calendar tap).
        await page.waitForFunction(() => !document.documentElement.classList.contains('chat-busy'), { timeout: 20000 });
        // same seam, second visitor: the last reload armed the one-shot
        // install hint (a restored archive + a quiet boot) and it lands
        // ~2.5s after init - squarely on this seam now that the layer's
        // seconds moved 7b past it. The dialog sits above the sheet and a
        // coordinate tap lands on it, not the pill (evaluate clicks sail
        // past, which is why every pin around it stays green). Dismiss it
        // like a user would - the rig's own later guard (the clear-data
        // seam) has always been the one to clean it up; here it just
        // happens earlier.
        // v1.49.0: the 7b spotlight seam dismisses the hint first when it
        // lands there — this seam only cleans up what still shows (the
        // hint is one-shot; once OK'd it never returns this run).
        await page.waitForFunction(() => !document.getElementById('app-dialog-backdrop').classList.contains('hidden'), { timeout: 6000 }).catch(() => {});
        await page.evaluate(() => { const b = document.getElementById('app-dialog-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('app-dialog-ok').click(); });
        await sleep(400);

        // 7b. v1.45.0 (divergence #1a + the owner's binary toggle): reduced
        // motion — the OS switch lands the marker, the toggle overrides it,
        // and a cleared key goes back to following the OS.
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-reduced')), 'normal boot: full motion, no ca-reduced marker');
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        ok(await page.evaluate(() => {
            const mk = (cls) => { const p = document.createElement('div'); p.className = cls; document.body.appendChild(p); const n = getComputedStyle(p).animationName; p.remove(); return n; };
            return mk('chat-anim-in') === 'ca-reduce-fade' && mk('animate-pulse') === 'none' && mk('ca-arch-liveico') === 'caArchLive';
        }), 'OS reduce: entries collapse to ca-reduce-fade, loops stop — and the live month\u2019s icon keeps its 6s turn (the v1.48.2 owner exception, computed)');
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('settings-sheet')).transitionDuration === '0s'), 'OS reduce: sheets snap open (transition-transform gated)');
        ok(await page.evaluate(() => { showTypingIndicator(); return !document.getElementById('typing-indicator'); }), 'OS reduce: the typing bubble never appears (hotfix 1)');
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => document.getElementById('motion-pill-reduced').getAttribute('aria-checked') === 'true' && document.getElementById('motion-pill-full').getAttribute('aria-checked') === 'false' && document.getElementById('motion-desc').textContent.indexOf('following') !== -1), 'the toggle mirrors the resolved state (Reduced, following the OS)');
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('motion-desc')).fontSize === '11px' && getComputedStyle(document.getElementById('calcui-desc')).fontSize === '11px'), 'panel descriptions ride the row species - 11px, like the Feedback row (v1.45.2)');
        await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('whatsnew-close').click(); });
        await sleep(400);
        await (await page.$('#motion-pill-full')).tap();
        await page.waitForFunction(() => !document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.motion') === 'full' && document.getElementById('motion-desc').textContent.indexOf('overrides') !== -1), 'tapping Full stores the override and clears the marker live');
        await page.evaluate(() => closeSettings());
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
        await page.evaluate(() => { localStorage.removeItem('crewAssist.motion'); });
        await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('#chat-container', { timeout: 20000 });
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-reduced')), 'cleared key: back to following the OS (no preference = full motion)');
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        ok(true, 'with no stored key the OS switch still lands the marker');
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
        await page.waitForFunction(() => !document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('whatsnew-close').click(); });
        await sleep(400);

        // 8. v1.43.0: the destination overlay + the roster capture.
        await page.evaluate(() => {
            localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [
                { ymd: '2026-10-09', kind: 'fly', code: '', loc: '', fns: ['231'], dkey: 'k1' },
                { ymd: '2026-10-10', kind: 'fly', code: '', loc: '', fns: ['232'], dkey: 'k1' },
                { ymd: '2026-10-12', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k2' },
            ], '2026-11': [
                { ymd: '2026-11-14', kind: 'fly', code: '', loc: '', fns: ['118'], dkey: 'k3' },
            ] }));
            localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
                { fn: '231', dep: 'SIN', arr: 'SYD', ymd: '2026-10-09', std: '09:00', sta: '19:05', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '08:05', ac: '359', rpt: '', pos: false },
                { fn: '232', dep: 'SYD', arr: 'SIN', ymd: '2026-10-10', std: '07:30', sta: '13:40', stdYmd: '2026-10-10', staYmd: '2026-10-10', ft: '08:10', ac: '359', rpt: '', pos: false },
                { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:10', ac: '7M8', rpt: '', pos: false },
                { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-12', std: '10:25', sta: '11:45', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:20', ac: '7M8', rpt: '', pos: false },
            ], '2026-11': [
                { fn: '118', dep: 'SIN', arr: 'KUL', ymd: '2026-11-14', std: '09:00', sta: '10:10', stdYmd: '2026-11-14', staYmd: '2026-11-14', ft: '01:10', ac: '7M8', rpt: '', pos: false },
            ] }));
        });
        await page.evaluate(() => openRosterCalendar());
        await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden'), { timeout: 5000 });
        await sleep(600);
        // round 33 (owner report: the FIRST open of a session on the PC showed
        // blank space below the grid until a close+reopen): the open itself
        // must land the selected day flush at the detail's top with rows in
        // view, and a window re-derived at an arbitrary resting position must
        // span the scroller — the head-spacer blank cannot exist
        ok(await page.evaluate(() => {
            const det = document.getElementById('ca-rc-detail');
            const sel = document.querySelector('.ca-rc-day.is-selected');
            if (!det || !sel) return false;
            const row = det.querySelector('.ca-rc-row[data-rc-ymd="' + sel.getAttribute('data-ymd') + '"]');
            const dr = det.getBoundingClientRect();
            const inView = Array.from(det.querySelectorAll('.ca-rc-row')).filter((r) => { const t = r.getBoundingClientRect(); return t.bottom > dr.top + 2 && t.top < dr.bottom - 2; });
            return !!row && Math.abs(row.getBoundingClientRect().top - dr.top) <= 2 && inView.length > 0;
        }), 'round 33: the first open lands the selected day flush at the detail\u2019s top with rows in view \u2014 never blank');
        ok(await page.evaluate(() => {
            const det = document.getElementById('ca-rc-detail');
            det.scrollTop = Math.max(0, Math.round((det.scrollHeight - det.clientHeight) / 2));
            rosterCalTLWindow();
            const dr = det.getBoundingClientRect();
            return Array.from(det.querySelectorAll('.ca-rc-row')).some((r) => { const t = r.getBoundingClientRect(); return t.bottom > dr.top + 2 && t.top < dr.bottom - 2; });
        }), 'round 33: a window re-derived at any resting position spans the scroller \u2014 the head-spacer blank cannot exist');
        ok(await page.evaluate(() => document.getElementById('ca-rc-fold').nextElementSibling === document.getElementById('ca-rc-tag') && document.getElementById('ca-rc-tag').nextElementSibling === document.getElementById('ca-rc-shot')), 'hotfix: the tag and camera sit right of the chevron');
        // v1.45.38 (owner order, the podium release): the records page,
        // proven live in Chromium
        ok(await page.evaluate(() => document.getElementById('ca-rc-shot').nextElementSibling === document.getElementById('ca-rc-pod') && !document.getElementById('ca-roster-cal').contains(document.getElementById('ca-rc-podwrap')) && document.body.contains(document.getElementById('ca-rc-podwrap'))), 'v1.45.38: the podium button ends the left cluster, and the records page is a direct child of <body> - never nested in the calendar sheet');
        ok(await page.evaluate(() => { const b = document.getElementById('ca-rc-pod'); return b && !b.classList.contains('hidden') && !!(b.querySelector('i[data-lucide="book-user"]')); }), 'v1.45.38 + v1.45.51: the passport button is revealed carrying the book-user icon (the rig blocks the CDN, so the pin reads the stub - the glyph itself is verified in the lucide bundle)');
        await page.evaluate(() => document.getElementById('ca-rc-pod').click());
        // v1.45.56 (owner order, the departure-board roll) + v1.48.0: the
        // open roll WAITS OUT the sheet's glide (~360ms) — read at ~460ms,
        // mid-roll. The hero text already reads the truth (the base digits
        // ARE the reel cells' text; the strips draw through ::before)
        await sleep(460);
        ok(await page.evaluate(() => { const vals = document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hval'); const strips = document.querySelectorAll('#ca-rc-pod-herowrap .ca-rollstrip'); return vals.length === 10 && document.querySelectorAll('#ca-rc-pod-herowrap .ca-rollc').length > 0 && Array.from(strips).every((x) => x.getAttribute('aria-hidden') === 'true') && Array.from(vals).every((v) => !/\d/.test(v.textContent) || v.querySelector('.ca-rollc')); }), 'v1.45.56 + v1.48.0: a fresh open ROLLS the hero digits once the sheet is up — reel cells mounted, strips aria-hidden, and every digit-bearing value reads its truth mid-roll');
        await sleep(600);
        ok(await page.evaluate(() => !document.getElementById('ca-rc-podwrap').classList.contains('hidden') && !document.getElementById('ca-rc-pod-sheet').classList.contains('translate-y-full')), 'v1.45.38: tapping the podium glides the records page up over the calendar');
        ok(await page.evaluate(() => document.querySelector('#ca-rc-pod-sheet h3').textContent === 'Passport' && document.getElementById('ca-rc-pod').getAttribute('aria-label') === 'Passport' && document.getElementById('ca-rc-pod').querySelector('i[data-lucide]').getAttribute('data-lucide') === 'book-user'), 'v1.45.51: the page titles itself Passport, and its button wears the book-user icon');
        // v1.45.52 (owner spec): the telemetry stack — pills, navy hero
        // (both themes), the collapsed-by-default gateway
        ok(await page.evaluate(() => {
            const pills = Array.from(document.querySelectorAll('#ca-rc-pod-years .ca-rc-pod-ypill'));
            return pills.length === 2 && pills[0].textContent === 'All-Time' && pills[0].classList.contains('on') && pills[1].textContent === '2026';
        }), 'v1.45.52: the main pills read All-Time (active) and the seeded 2026 travel year');
        ok(await page.evaluate(() => document.getElementById('ca-rc-statwrap').classList.contains('hidden') && document.getElementById('ca-rc-stat-sheet').classList.contains('translate-y-full')), 'v1.45.53 (owner order): All Flight Stats starts as its OWN closed overlay above the passport — the hero leads the page');
        ok(await page.evaluate(() => { const v = document.querySelector('#ca-rc-pod-herowrap .ca-rc-pod-hval'); const cs = getComputedStyle(v); return cs.fontFamily.indexOf('Space Mono') < 0 && cs.fontWeight === '700' && cs.fontVariantNumeric === 'tabular-nums'; }), 'v1.45.53 (owner order): the hero figures wear the EARNINGS page type — the house sans, bold, tabular-nums — never Space Mono');
        ok(await page.evaluate(() => {
            const cell = (l) => Array.from(document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hcell')).find((c) => c.querySelector('.ca-rc-pod-hlabel').textContent.trim() === l);
            const f = cell('Flights'), t = cell('Flight Time'), a = cell('Airports');
            // the calendar section's seed: the four landed October legs
            // (08:05 + 08:10 + 01:10 + 01:20 = 18h 45m, SYD + KUL); the
            // November leg is not flown yet — a passport counts landed legs
            return document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hcell').length === 10 && f && f.querySelector('.ca-rc-pod-hval').textContent === '4' && t && t.querySelector('.ca-rc-pod-hval').textContent === '18h 45m' && a && a.querySelector('.ca-rc-pod-hval').textContent === '2';
        }), 'v1.45.52: the hero computes the calendar seed — 4 landed legs, 18h 45m block time, 2 airports, ten metrics (the unflown November leg never counts)');
        // v1.45.58 (owner report): the visit-log drawer honours the year
        // filter. Seed a 2025 KUL visit beside the seeded 2026 one, open
        // the stats overlay, and read the drawer both ways — all-time
        // holds both years, the 2026 chip holds only 2026
        await page.evaluate(() => {
            const st = JSON.parse(localStorage.getItem('crewAssist.allFlights') || '{}');
            st['2025-04'] = [
                { fn: '104', dep: 'SIN', arr: 'KUL', ymd: '2025-04-10', std: '08:00', sta: '09:25', stdYmd: '2025-04-10', staYmd: '2025-04-10', ft: '01:25', ac: '7M8', rpt: '', pos: false },
                { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2025-04-10', std: '10:25', sta: '11:50', stdYmd: '2025-04-10', staYmd: '2025-04-10', ft: '01:25', ac: '7M8', rpt: '', pos: false }
            ];
            localStorage.setItem('crewAssist.allFlights', JSON.stringify(st));
            renderRcPod();
        });
        await sleep(400);
        await page.evaluate(() => document.getElementById('ca-rc-pod-gate').click());
        await sleep(600);
        const drawerText = () => page.evaluate(() => { const el = document.querySelector('.ca-rc-pod-xp'); return el ? el.innerText.replace(/\s+/g, ' ') : ''; });
        await page.evaluate(() => document.querySelector('[data-ca-rc-pod-station="KUL"]').click());
        await sleep(500);
        ok((await drawerText()).indexOf('2 VISITS') !== -1 && (await drawerText()).indexOf('2025') !== -1 && (await drawerText()).indexOf('12 Oct 2026') !== -1, 'v1.45.58 setup: all-time, the KUL flight history holds both years — the 2025 visit and the 2026 one');
        await page.evaluate(() => document.querySelector('[data-ca-rc-pod-station="KUL"]').click());
        await sleep(500);
        await page.evaluate(() => { const y = Array.from(document.querySelectorAll('#ca-rc-pod-listyears .ca-rc-pod-ypill')).find((b) => b.textContent === '2026'); y.click(); });
        await sleep(500);
        await page.evaluate(() => document.querySelector('[data-ca-rc-pod-station="KUL"]').click());
        await sleep(500);
        const d58 = await drawerText();
        ok(d58.indexOf('1 VISIT') !== -1 && d58.indexOf('12 Oct 2026') !== -1 && d58.indexOf('2025') === -1, 'v1.45.58 (owner report): the 2026 chip\'s flight history holds ONLY the 2026 visit — no other year\'s record leaks into the filtered drawer');
        // restore the section's world exactly as this block found it: the
        // 2025 legs leave the store, the chips return to All-Time (folding
        // the open log with them), the hero re-renders settled on the
        // original four-leg landscape, and the overlay closes — the pins
        // downstream still expect the seed this section opened with
        await page.evaluate(() => {
            const st = JSON.parse(localStorage.getItem('crewAssist.allFlights') || '{}');
            delete st['2025-04'];
            localStorage.setItem('crewAssist.allFlights', JSON.stringify(st));
            const all = Array.from(document.querySelectorAll('#ca-rc-pod-listyears .ca-rc-pod-ypill')).find((b) => b.textContent === 'All-Time');
            if (all) all.click();
            renderRcPod();
        });
        await sleep(600);
        await page.evaluate(() => closeRcStat());
        await sleep(600);
        ok(await page.evaluate(() => {
            // v1.45.55 (owner order, the color round): the card IS the
            // earnings GOLD card — FIXED in both themes. Force dark,
            // read, force light, read, restore: gradient + espresso
            // figures compute IDENTICALLY — gold is gold day and night
            const h = document.documentElement;
            const card = document.querySelector('#ca-rc-pod-herowrap .ca-rc-pod-tel');
            const read = () => getComputedStyle(card).backgroundImage + '|' + getComputedStyle(cell('Flights')).color;
            const cell = (l) => Array.from(document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hcell')).find((c) => c.querySelector('.ca-rc-pod-hlabel').textContent.trim() === l).querySelector('.ca-rc-pod-hval');
            const wasDark = h.classList.contains('dark');
            h.classList.add('dark');
            const darkInk = read();
            h.classList.remove('dark');
            const lightInk = read();
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return darkInk === lightInk && darkInk.indexOf('linear-gradient(135deg, rgb(220, 193, 99) 0%, rgb(201, 162, 62) 60%, rgb(184, 148, 47) 100%)') === 0 && darkInk.endsWith('rgb(26, 19, 0)');
        }), 'v1.45.55 (owner order): the hero card IS the gold card — the earnings gradient with espresso figures, computing IDENTICALLY in dark and light (gold is gold day and night)');
        ok(await page.evaluate(() => { const rows = document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hrow'); const labels = (r) => Array.from(r.querySelectorAll('.ca-rc-pod-hlabel')).map((l) => l.textContent.trim()).join('|'); return rows.length === 5 && labels(rows[0]) === 'Flights|Flight Time' && labels(rows[1]) === 'Airports|Regions' && labels(rows[2]) === 'Top rostered|Top aircraft' && labels(rows[3]) === 'Longest flight|Layover days' && labels(rows[4]) === 'First flight|Latest flight' && !!document.querySelector('#ca-rc-pod-herowrap .ca-rc-pod-hrule') && document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hcell').length === 10; }), 'v1.45.55 (owner order, strict): five rows of two in the owner\u2019s exact order — Flights|Flight Time large, the rule, then the story rows; ten cells, nothing lost, nothing renamed but Top rostered');
        ok(await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const gate = document.getElementById('ca-rc-pod-gate'); const read = () => getComputedStyle(gate).backgroundColor + '|' + getComputedStyle(gate).color; const wasDark = h.classList.contains('dark'); h.classList.remove('dark'); await sleep(50); const light = read(); h.classList.add('dark'); await sleep(50); const dark = read(); if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return light === 'rgb(17, 17, 17)|rgb(255, 255, 255)' && dark === 'rgb(246, 241, 232)|rgb(23, 29, 43)'; }), 'v1.45.54 (owner order: solid): the gate fills with the theme\u2019s ink pole - near-black with white text by day, cream with espresso text at night (the outline retires)');
        ok(await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const track = document.getElementById('ca-rc-pod-years'); const on = track.querySelector('.ca-rc-pod-ypill.on'); const read = () => getComputedStyle(track).backgroundColor + '|' + getComputedStyle(on).backgroundColor + '|' + getComputedStyle(on).color; const wasDark = h.classList.contains('dark'); h.classList.remove('dark'); await sleep(1000); const light = read(); h.classList.add('dark'); await sleep(1000); const dark = read(); if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return light === 'rgba(0, 0, 0, 0.08)|rgb(255, 255, 255)|rgb(45, 30, 15)' && dark === 'rgba(255, 255, 255, 0.08)|rgb(246, 241, 232)|rgb(23, 29, 43)'; }), 'v1.45.54 (owner order): the year pills ride the earnings segtrack - a hairline-washed track, the selected year a solid bright pill, theme-tuned twins');
        // v1.45.56: the settle — the reels unwrap and the plain markup
        // returns (worst restore ~840ms; the waits above plus this one
        // clear it)
        await sleep(600);
        ok(await page.evaluate(() => document.querySelectorAll('#ca-rc-pod-herowrap .ca-rollc').length === 0 && Array.from(document.querySelectorAll('#ca-rc-pod-herowrap .ca-rc-pod-hval')).map((v) => v.textContent).indexOf('4') === 0), 'v1.45.56 (owner order): the roll settles — reel cells unwrap, the plain hero markup returns, Flights still reads 4');
        // v1.46.1 (owner orders): the passport camera opens the YEAR PICKER
        // (its own sub-sheet), the crew pick all-time or any year — the
        // hero poses to the pick, and (v1.47.0) the canvas hand-paints it
        // with the roster technique; the crew's own chip returns
        ok(await page.evaluate(() => document.getElementById('btn-rc-pod-cam').parentElement === document.getElementById('btn-close-rc-pod').parentElement), 'v1.46.1 (owner order): the camera rides one right cluster with the close button — title changes can never shift it');
        await page.evaluate(() => { window.__caLastShot = null; document.getElementById('btn-rc-pod-cam').click(); });
        await sleep(500);
        ok(await page.evaluate(() => !document.getElementById('ca-rc-podcapwrap').classList.contains('hidden') && document.getElementById('ca-rc-podcap-title').textContent === 'Capture passport'), 'v1.46.1: the camera opens the year picker as its own sub-sheet over the passport');
        const podRows = await page.evaluate(() => Array.from(document.querySelectorAll('#ca-rc-podcap-body .ca-cap-yearrow')).map((r) => r.getAttribute('data-yr')));
        ok(podRows.length >= 2 && podRows[0] === 'all' && podRows.slice(1).join(',') === podRows.slice(1).map(Number).sort((a, b) => b - a).map(String).join(','), 'the picker offers All-Time first, then every year on record newest-first');
        await page.evaluate(() => document.querySelector('#ca-rc-podcap-body .ca-cap-yearrow[data-yr="all"]').click());
        await page.waitForFunction(() => !!window.__caLastShot, { timeout: 15000 });
        ok(await page.evaluate(() => window.__caLastShot.name === 'CrewAssist-Passport-All-Time.png' && window.__caLastShot.size > 2000), 'v1.46.1: picking all-time delivers a real PNG named app + all-time');
        ok(await page.evaluate(async () => {
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            const seen = new Set();
            for (let i = 0; i < data.length; i += 40) seen.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
            return seen.size > 8 && bmp.width > 200 && bmp.height > 250 && bmp.height < 1200;
        }), 'v1.46.1: the hero capture decodes hero-sized and richly painted — the ten-cell card, not a blank or a full-page crop');
        ok(await page.evaluate(async () => {
            // v1.47.1 (the owner's hotfix): the capture is the hero card
            // PLUS its title band — the card itself at its exact live
            // size, the 34px band above it, nothing else. No pills, no
            // trim air, no painter library — the hand-painted canvas
            // over the live DOM
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const hero = document.getElementById('ca-rc-pod-herowrap').getBoundingClientRect();
            return Math.abs(bmp.height - hero.height - 34) <= 2 && Math.abs(bmp.width - hero.width) <= 2;
        }), 'v1.47.1 (the owner\u2019s "exactly what is on screen" + the title order): the capture is the live hero card exactly, with its 34px title band above — no pills, no trim');
        ok(await page.evaluate(async () => {
            // v1.47.1 (owner hotfix — render the title): the band above the
            // card carries "All-Time Flight Records", painted in the house
            // typeface at its true width (a fallback font would miss by
            // pixels) — the row-median ink scan, theme-proof
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            let tMin = 1e9, tMax = -1;
            for (let y = 4; y < Math.min(30, c.height); y++) {
                const row = [];
                for (let p = 0; p < c.width; p++) { const i = (y * c.width + p) * 4; row.push(data[i] + ',' + data[i + 1] + ',' + data[i + 2]); }
                row.sort();
                const med = row[Math.floor(row.length / 2)].split(',').map(Number);
                for (let p = 6; p < c.width - 6; p++) {
                    const i = (y * c.width + p) * 4;
                    if (Math.abs(data[i] - med[0]) > 40 || Math.abs(data[i + 1] - med[1]) > 40 || Math.abs(data[i + 2] - med[2]) > 40) { if (p < tMin) tMin = p; if (p > tMax) tMax = p; }
                }
            }
            const tw = document.createElement('canvas').getContext('2d');
            tw.font = '700 18px "Plus Jakarta Sans", sans-serif';
            const want = tw.measureText('All-Time Flight Records').width;
            const headW = (tMax >= tMin) ? tMax - tMin + 1 : -1;
            return headW > 0 && Math.abs(headW - want) <= 4;
        }), 'v1.47.1 (owner order): the title band carries "All-Time Flight Records" — painted in the armed house typeface, centered over the card');
        ok(await page.evaluate(async () => {
            // the hand-paint's own proofs: the card's 135° gold gradient
            // surface (the far corners must differ) and the label band's
            // ink — the texts AND the 12px lucide icons beside them
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3);
            const tl = px(24, 58), br = px(c.width - 24, c.height - 24);
            const grad = Math.abs(tl[0] - br[0]) + Math.abs(tl[1] - br[1]) + Math.abs(tl[2] - br[2]) > 12;
            const ref = px(Math.floor(c.width / 2), 40);
            const band = x.getImageData(0, 48, c.width, 50).data;
            let ink = 0;
            for (let i = 0; i < band.length; i += 16) {
                if (Math.abs(band[i] - ref[0]) + Math.abs(band[i + 1] - ref[1]) + Math.abs(band[i + 2] - ref[2]) > 60) ink++;
            }
            return grad && ink > 40;
        }), 'v1.47.0: the repaint carries the card\u2019s gradient surface and the label band\u2019s ink — texts and icons alike, no painter library involved');
        ok(await page.evaluate(() => { const on = document.querySelector('#ca-rc-pod-years .ca-rc-pod-ypill.on'); return !!on && document.querySelectorAll('#ca-rc-pod-herowrap .ca-rollc').length === 0 && !document.documentElement.classList.contains('ca-reduced'); }), 'v1.46.1: the crew\u2019s own chip returns, the roll settles and no pose guard lingers');
        // v1.46.6 (owner order — the native share sheet, directly): the
        // preview experiment is gone; the capture delivers straight away
        // (the anchor here — headless Chromium ships no share API) and
        // the passport page stands clear behind nothing
        ok(await page.evaluate(() => !document.getElementById('ca-cap-preview')), 'v1.46.6: no preview sheet exists after the passport capture — no lingering overlay over the records page');
        await page.evaluate(() => document.getElementById('ca-rc-pod-gate').click());
        await sleep(1000);
        ok(await page.evaluate(() => !document.getElementById('ca-rc-statwrap').classList.contains('hidden') && !document.getElementById('ca-rc-stat-sheet').classList.contains('translate-y-full') && document.querySelector('#ca-rc-stat-sheet h3').textContent === 'My Flight Stats'), 'v1.45.53 (owner order): one tap on My Flight Stats raises the overlay — its own sheet, titled with its new name, glided up over the passport (no accordion)');
        ok(await page.evaluate(() => document.getElementById('ca-rc-stat-subtitle').textContent === 'All-time \u00b7 since Oct 2026'), 'v1.45.53: the overlay carries its own subtitle — the list window, named');
        ok(await page.evaluate(() => { const tabs = document.querySelectorAll('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab]'); const dark = document.documentElement.classList.contains('dark'); const bg = dark ? 'rgb(246, 241, 232)' : 'rgb(255, 255, 255)'; const ink = dark ? 'rgb(23, 29, 43)' : 'rgb(45, 30, 15)'; return tabs.length === 3 && tabs[0].textContent === 'All Flights' && tabs[0].classList.contains('ca-rc-pod-tabon') && !document.querySelector('.ca-rc-pod-glider') && getComputedStyle(tabs[0]).backgroundColor === bg && getComputedStyle(tabs[0]).color === ink; }), 'v1.45.54 (owner order): the segtrack tab bar carries all three lists; the selected tab IS the bright pill — a solid ink-pole pill per theme (the gold glider retires)');
        ok(await page.evaluate(() => { const tab = document.querySelector('#ca-rc-pod-tabs-wrap .ca-rc-pod-tab'); const pill = document.querySelector('#ca-rc-pod-listyears .ca-rc-pod-ypill'); return !!tab && !!pill && Math.abs(tab.offsetHeight - pill.offsetHeight) <= 1; }), 'v1.45.55 (owner order): the tab pills and the year pills share one height — matched vertical metrics, one pill family');
        ok(await page.evaluate(() => document.getElementById('ca-rc-pod-subtitle').textContent === 'All-time \u00b7 since Oct 2026'), 'v1.45.39: the subtitle names the all-time window from the earliest flown leg');
        ok(await page.evaluate(() => { const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return cards.length === 2 && cards[1].classList.contains('ca-rc-pod-hero') && cards[1].textContent.indexOf('KUL') >= 0 && cards[1].textContent.indexOf('\u00d71') >= 0 && !!cards[1].querySelector('i[data-lucide="crown"]') && cards[0].textContent.indexOf('2nd') >= 0 && cards[0].textContent.indexOf('SYD') >= 0; }), 'v1.45.39: the 2-1-3 podium ranks the seeded truth as VISITS - KUL \u00d71 crowned center (the future November leg does NOT count: records are current to wheels-down), SYD 2nd at the side');
        ok(await page.evaluate(() => { const hero = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero'); const want = document.documentElement.classList.contains('dark') ? 'rgb(20, 24, 35)' : 'rgb(255, 255, 255)'; return hero.classList.contains('ca-rc-pod-d0') && getComputedStyle(hero).backgroundColor === want && getComputedStyle(hero).borderColor === 'rgba(201, 162, 39, 0.35)'; }), 'v1.45.55 (owner order, the color round): the rank-one card rides the archive\u2019s navy surface at night, white by day, and keeps the gold edge beside its crown (the mount stagger stays)');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero').click());
        await sleep(400);
        ok(await page.evaluate(() => { const xp = document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'); return !!xp && xp.classList.contains('ca-rc-pod-xpon') && xp.textContent.indexOf('12 Oct 2026') >= 0 && xp.textContent.indexOf('SQ 106') >= 0 && xp.textContent.indexOf('TA') >= 0; }), 'v1.45.42: tapping the hero unfolds the visit log - date, flight number and kind, live in Chromium');
        ok(await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero').getAttribute('aria-expanded') === 'true'), 'the expanded station announces itself (aria)');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero').click());
        await sleep(400);
        ok(await page.evaluate(() => !document.querySelector('#ca-rc-pod-body .ca-rc-pod-xpon')), 'tapping it again folds the log away');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero').click());
        await sleep(400);
        ok(await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const el = document.querySelector('#ca-rc-pod-body .ca-rc-pod-xpon .ca-rc-pod-xld'); if (!el) return false; const wasDark = h.classList.contains('dark'); h.classList.remove('dark'); await sleep(1000); const light = getComputedStyle(el).color; h.classList.add('dark'); await sleep(1000); const dark = getComputedStyle(el).color; if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return light === 'rgb(17, 24, 39)' && dark === 'rgb(255, 255, 255)'; }), 'v1.45.43: the visit-log date rides the inherited theme ink - near-black on the light glass, WHITE on the dark glass (the navy-on-dark-glass report, computed both themes)');
        // v1.45.44 (owner orders, the grounding round): the anchor ring,
        // the recede, the drawer's name, and the tag-hue kind marks -
        // all computed, both themes, transition-aware (the 200ms recede
        // and the body's 300ms ink change are waited out before reads)
        ok(await page.evaluate(() => { const b = document.getElementById('ca-rc-pod-body'); const hero = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero'); return b.classList.contains('ca-rc-pod-hasopen') && hero.classList.contains('ca-rc-pod-on') && getComputedStyle(hero).borderColor === 'rgba(201, 162, 39, 0.45)'; }), 'v1.45.44: the open station wears the gold ring - the strong gold line, computed (the anchor holds the view while its log is out)');
        const recedeVals = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const side = document.querySelector('#ca-rc-pod-body .ca-rc-pod-card:not(.ca-rc-pod-on)'); if (!side) return 'NO SIDE'; const wasDark = h.classList.contains('dark'); h.classList.add('dark'); await sleep(900); const darkOp = getComputedStyle(side).opacity; h.classList.remove('dark'); await sleep(900); const lightOp = getComputedStyle(side).opacity; if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return 'dark=' + darkOp + ' light=' + lightOp; });
        ok(recedeVals === 'dark=0.25 light=0.4', 'v1.45.44: the sibling cards recede while the log is open - 25% on the dark glass, 40% on the light linen (theme-tuned, computed both themes) [got: ' + recedeVals + ']');
        ok(await page.evaluate(() => { const ph = document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp] .ca-rc-pod-xph'); return !!ph && ph.textContent.indexOf('FLIGHT HISTORY') >= 0 && ph.textContent.indexOf('KUL') >= 0 && ph.textContent.indexOf('1 VISIT') >= 0; }), 'v1.45.44: the drawer names its station and its count - the tag agrees with the \u00d71 the hero shows (singular)');
        ok(await page.evaluate(() => { const ph = document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp] .ca-rc-pod-xph'); return !!ph && getComputedStyle(ph).borderBottomStyle === 'dashed' && !!(ph.querySelector('.ca-rc-pod-xphl')) && !!(ph.querySelector('.ca-rc-pod-xphn')); }), 'v1.45.44: the drawer header parts from the visit lines on a dashed hairline (computed - the single-visit line itself is a :last-child and rightly carries NO border)');
        ok(await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const k = document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp] .ca-rc-pod-xlk-ta'); if (!k) return false; const wasDark = h.classList.contains('dark'); h.classList.add('dark'); await sleep(1000); const darkCol = getComputedStyle(k).color; h.classList.remove('dark'); await sleep(1000); const lightCol = getComputedStyle(k).color; if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return darkCol === 'rgb(134, 239, 172)' && lightCol === 'rgb(21, 128, 61)'; }), 'v1.45.44: the turnaround mark rides the calendar tag hue - green-300 on dark, the deep green on light (computed both themes, the owner order over the old stone)');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero').click());
        await sleep(400);
        ok(await page.evaluate(() => { const hero = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero'); return getComputedStyle(hero.querySelector('.ca-rc-pod-code')).fontSize === '20px'; }), 'v1.45.40: the hero code computes to 20px - the half-step scale-up, sized by the custom rule');
        ok(await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const h = document.documentElement; const x = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero .ca-rc-pod-x'); if (!x || x.textContent !== '\u00d7') return false; const wasDark = h.classList.contains('dark'); h.classList.add('dark'); await sleep(1000); const darkCol = getComputedStyle(x).color; h.classList.remove('dark'); await sleep(1000); const lightCol = getComputedStyle(x).color; if (wasDark) h.classList.add('dark'); else h.classList.remove('dark'); return darkCol === 'rgb(168, 162, 158)' && lightCol === 'rgb(120, 113, 108)'; }), 'v1.45.40+1.45.45: the multiplier glyph stays stone ink - stone-400 on the dark glass, stone-500 in light (the accessibility bump, computed both themes) while the count stays bold');
        ok(await page.evaluate(() => !document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]') && document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length === 0), 'v1.45.39: no leaderboard rows and no View-all door when the list fits the podium');
        ok(await page.evaluate(() => { const tabs = () => document.querySelectorAll('#ca-rc-pod-tabs-wrap .ca-rc-pod-tab'); const before = tabs()[0].classList.contains('ca-rc-pod-tabon'); document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click(); const after = tabs()[1].classList.contains('ca-rc-pod-tabon') && !tabs()[0].classList.contains('ca-rc-pod-tabon'); const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return before && after && cards.length === 1 && cards[0].classList.contains('ca-rc-pod-hero') && cards[0].textContent.indexOf('SYD') >= 0 && !cards[0].classList.contains('ca-rc-pod-d0'); }), 'v1.45.39: tapping Layovers moves the bright pill across and swaps the panel INSTANT - SYD alone lays over, and the stagger never replays on a swap');
        ok(await page.evaluate(() => { document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click(); const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return cards.length === 1 && cards[0].textContent.indexOf('KUL') >= 0; }), 'v1.45.39: the Turnarounds tab carries the quick-ground list');
        // both themes are a hard acceptance criterion: the sheet and the
        // podium cards' fills must shift with the dark class (real var()
        // resolution - white cards by day, 2% glass at night)
        ok(await page.evaluate(() => {
            const h = document.documentElement;
            const read = () => getComputedStyle(document.getElementById('ca-rc-pod-sheet')).backgroundColor + '|' + getComputedStyle(document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero')).backgroundColor;
            const wasDark = h.classList.contains('dark');
            h.classList.remove('dark');
            const light = read();
            h.classList.add('dark');
            const dark = read();
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return light !== dark;
        }), 'v1.45.39: both themes carry the records page - sheet and hero fills shift with the dark class');
        await page.evaluate(() => document.getElementById('btn-close-rc-pod').click());
        await sleep(700);
        ok(await page.evaluate(() => document.getElementById('ca-rc-podwrap').classList.contains('hidden') && document.getElementById('ca-rc-pod-sheet').classList.contains('translate-y-full')), 'v1.45.38: closing glides the page below the fold and hides the wrap after the window');
        ok(await page.evaluate(() => !document.getElementById('ca-roster-cal').classList.contains('hidden')), 'v1.45.38: closing the records page returns to the live calendar behind it');
        ok(await page.evaluate(() => {
            const g = document.getElementById('ca-rc-grid');
            const tagBtn = document.getElementById('ca-rc-tag');
            return !!g && g.querySelectorAll('.ca-rc-day').length >= 30 && tagBtn && !tagBtn.classList.contains('hidden') && document.getElementById('ca-rc-shot').classList.contains('hidden') && !g.classList.contains('rc-tags-on');
        }), 'the calendar opens with the overlay off and the camera hidden');
        ok(await page.evaluate(() => {
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            return !t || getComputedStyle(t).display === 'none';
        }), 'no tags are visible while the overlay is off');
        await page.evaluate(() => document.getElementById('ca-rc-tag').click());
        await sleep(300);
        ok(await page.evaluate(() => document.getElementById('ca-rc-grid').classList.contains('rc-tags-on') && !document.getElementById('ca-rc-shot').classList.contains('hidden')), 'one tap lights the overlay and shows the camera');
        // the on-fill FADES IN (transition-colors): under a full run's load the
        // 300ms read can land mid-fade (alpha < 1) and false-negative. Let the
        // fade settle before reading the computed fill.
        await sleep(1000);
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('ca-rc-tag')).backgroundColor === 'rgb(201, 162, 39)'), 'hotfix: the toggle fills gold when on (computed — immune to the sticky touch hover)');
        ok(await page.evaluate(() => {
            const t9 = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            const t10 = document.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-tag');
            const b10 = document.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-badge');
            const t12 = document.querySelector('.ca-rc-day[data-ymd="2026-10-12"] .ca-rc-tag');
            const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
            return vis(t9) && t9.textContent === 'SYD' && t9.className.includes('ca-rc-tag-lo')
                && !t10 && vis(b10) && b10.textContent === '2'
                && vis(t12) && t12.textContent === 'KUL' && t12.className.includes('ca-rc-tag-ta');
        }), 'hotfix: the tags render once each — SYD orange on the outbound day only, band 2 homecoming, KUL turnaround');
        ok(await page.evaluate(() => {
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            const b = document.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-badge');
            const ts = getComputedStyle(t), bs = getComputedStyle(b);
            return parseFloat(ts.fontSize) >= 11 && parseFloat(bs.fontSize) >= 11 && parseFloat(bs.right) >= 6 && parseFloat(bs.bottom) >= 6;
        }), 'hotfix: the tag and badge read larger, the badge tucked inward');
        // v1.44.1 typography discipline: the calendar's marks sit at the MICRO
        // rung (11px) and the day numbers at the BODY rung (14px) — computed
        // in the real browser against the live stylesheet
        ok(await page.evaluate(() => {
            const n = document.querySelector('.ca-rc-day[data-ymd="2026-10-12"] .ca-rc-num');
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            const b = document.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-badge');
            return n && parseFloat(getComputedStyle(n).fontSize) === 14 && parseFloat(getComputedStyle(t).fontSize) === 11 && parseFloat(getComputedStyle(b).fontSize) === 11;
        }), 'v1.44.1: the calendar type sits on the fixed scale — day numbers at 14, marks at the 11px MICRO floor');
        ok(await page.evaluate(() => {
            const day = document.querySelector('.ca-rc-day[data-ymd="2026-10-12"]');
            const t = day.querySelector('.ca-rc-tag');
            const b = day.querySelector('.ca-rc-badge');
            if (!t || !b || getComputedStyle(t).display === 'none') return false;
            const rt = t.getBoundingClientRect(), rb = b.getBoundingClientRect();
            const apart = rt.bottom <= rb.top + 0.5 || rb.bottom <= rt.top + 0.5 || rt.right <= rb.left + 0.5 || rb.right <= rt.left + 0.5;
            // the badge is the homecoming arrival band (105 lands 11:45 → morning band 1)
            return apart && b.textContent === '1';
        }), 'hotfix: on a both-marks day the tag and the badge never intersect (tag owns the top band, badge the bottom)');
        await page.evaluate(() => document.getElementById('ca-rc-tag').click());
        // v1.45.51 (owner report, the hide-tap flash): the exit is clean —
        // no out animation, no replay window; the class drop IS the hide.
        // Read in the SAME task as the tap, before any sleep can mask it.
        ok(await page.evaluate(() => {
            const g = document.getElementById('ca-rc-grid');
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            const cam = document.getElementById('ca-rc-shot');
            return !g.classList.contains('rc-tags-on') && g.className.indexOf('rc-tags-out') < 0 && getComputedStyle(t).display === 'none' && getComputedStyle(t).animationName === 'none' && cam.classList.contains('hidden') && getComputedStyle(cam).animationName === 'none';
        }), 'v1.45.51: tapping the tag icon off hides the marks and the camera in the same frame — no exit animation, no flash on the way out (the owner report)');
        await sleep(350);
        await page.evaluate(() => document.getElementById('ca-rc-tag').click());
        await sleep(400);
        await page.evaluate(() => { window.__rcLastShot = null; document.getElementById('ca-rc-shot').click(); });
        await page.waitForFunction(() => !!window.__rcLastShot, { timeout: 10000 });
        ok(await page.evaluate(() => { const sh = window.__rcLastShot; return sh.name === 'CrewAssist-Roster-October-2026.png' && sh.size > 2000; }), 'the capture renders a real PNG named app + month + year');
        ok(await page.evaluate(async () => {
            const bmp = await createImageBitmap(window.__rcLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            const seen = new Set();
            for (let i = 0; i < data.length; i += 40) seen.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
            return seen.size > 8 && bmp.width > 200;
        }), 'hotfix: the capture photographs the live grid as-is (a blank or header-only shot would carry ~3 colors)');
        // round 15 (owner orders): the pop-in is a ONE-SHOT on the toggle —
        // a month change never replays it, and a hold-then-swipe toward a
        // missing month is as dead as the greyed arrow (real gesture, real
        // pointer stream, real Chromium)
        ok(await page.evaluate(() => {
            const g = document.getElementById('ca-rc-grid');
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            return g.classList.contains('rc-tags-on') && !g.classList.contains('rc-tags-pop') && getComputedStyle(t).animationName === 'none';
        }), 'round 15: after the pop window the marks sit settled — overlay on, no animation running');
        await page.evaluate(() => document.getElementById('ca-rc-tag').click());
        await sleep(400);
        await page.evaluate(() => document.getElementById('ca-rc-tag').click());
        await sleep(150);
        ok(await page.evaluate(() => {
            const g = document.getElementById('ca-rc-grid');
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
            return g.classList.contains('rc-tags-pop') && getComputedStyle(t).animationName === 'ca-rc-pop';
        }), 'round 15: a fresh toggle still pops the marks in (the one-shot lives on the transition)');
        await page.evaluate(() => document.getElementById('ca-rc-next').click());
        await sleep(700);
        ok(await page.evaluate(() => {
            const g = document.getElementById('ca-rc-grid');
            const t = document.querySelector('.ca-rc-day[data-ymd="2026-11-14"] .ca-rc-tag');
            return document.getElementById('ca-rc-month').textContent.trim() === 'Nov 2026' && g.classList.contains('rc-tags-on') && !g.classList.contains('rc-tags-pop') && t && getComputedStyle(t).animationName === 'none';
        }), 'round 15: an arrow month change lands on November settled — the fresh mark never re-pops');
        {
            const box = await page.evaluate(() => { const r = document.getElementById('ca-rc-grid').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
            await page.mouse.move(box.x, box.y);
            await page.mouse.down();
            await sleep(250);   // past the 140ms hold park
            for (let i = 1; i <= 6; i++) await page.mouse.move(box.x - i * 25, box.y + (i % 2));
            ok(await page.evaluate(() => !document.getElementById('ca-rc-grid').classList.contains('ca-rc-drag') && !document.querySelector('.ca-rc-track')), 'round 15: a hold-then-swipe toward the missing December disarms at once — no drag, no track');
            await page.mouse.up();
            await sleep(600);
            ok(await page.evaluate(() => document.getElementById('ca-rc-month').textContent.trim() === 'Nov 2026'), 'round 15: the release changes nothing at the last data month — the swipe respects the edge like the arrow');
        }
        await page.evaluate(() => document.getElementById('ca-rc-prev').click());
        await sleep(700);
        // round 16 (owner report, iPhone 11 — its zoomed-display mode runs an
        // effective ~375px): the month NEVER wraps to two rows, and the
        // trimmed header chrome keeps its distance on narrow screens
        ok(await page.evaluate(() => {
            const h3 = document.getElementById('ca-rc-month');
            const left = h3.closest('.flex.items-center');
            const right = document.getElementById('ca-rc-prev').parentElement;
            return getComputedStyle(h3).whiteSpace === 'nowrap' && h3.getBoundingClientRect().height <= 18 && left.getBoundingClientRect().right <= right.getBoundingClientRect().left + 0.5;
        }), 'round 16: at 390px with the overlay on, the month stays one row and the header groups never collide');
        await page.setViewport({ width: 375, height: 844, hasTouch: true });
        await sleep(300);
        ok(await page.evaluate(() => {
            const h3 = document.getElementById('ca-rc-month');
            const left = h3.closest('.flex.items-center');
            const right = document.getElementById('ca-rc-prev').parentElement;
            return getComputedStyle(h3).whiteSpace === 'nowrap' && h3.getBoundingClientRect().height <= 18
                && left.getBoundingClientRect().right <= right.getBoundingClientRect().left + 0.5
                && parseFloat(getComputedStyle(document.getElementById('ca-rc-fold')).paddingLeft) <= 6.5
                && parseFloat(getComputedStyle(document.getElementById('ca-rc-tag')).paddingLeft) <= 8.5;
        }), 'round 16: at 375px (the zoomed-iPhone class) the trim engages — still one row, no collision, tighter buttons');
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        await page.evaluate(() => document.getElementById('ca-rc-fold').click());
        await sleep(600);
        ok(await page.evaluate(() => document.getElementById('ca-rc-grid').classList.contains('hidden') && document.getElementById('ca-rc-tag').classList.contains('hidden') && document.getElementById('ca-rc-shot').classList.contains('hidden') && !document.getElementById('ca-rc-grid').classList.contains('rc-tags-on')), 'collapsing hides both buttons and forces the overlay off');
        await page.evaluate(() => document.getElementById('ca-rc-close').click());
        await sleep(800);
        ok(await page.evaluate(() => document.getElementById('ca-roster-cal').classList.contains('hidden')), 'the calendar closes');
        // hotfix: a finger tap must return a button to its resting look —
        // hover utilities now compile behind (hover:hover), so a touch tap
        // can never latch a wash (toggles keep their class-based state)
        // the rig's viewport runs hasTouch, so Chrome natively reports
        // (hover: none) — the world the owner's phone lives in. First clear
        // the stage: any reload re-offers What's New (the v1.35.0 ruling —
        // closing never counts as seen), and its backdrop would eat every
        // pointer tap.
        await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('whatsnew-close').click(); });
        // the one-time install hint (a tab user with saved earnings — the
        // restored phone qualifies) can land on a quiet moment too; dismiss
        // it like a user would
        await page.evaluate(() => { const dl = document.getElementById('app-dialog-backdrop'); if (dl && !dl.classList.contains('hidden')) document.getElementById('app-dialog-ok').click(); });
        await sleep(400);
        // closing What's New releases the welcome chat — and the chat-busy
        // rest (hotfix 12) correctly refuses the calendar button while it
        // types, so wait for the chat to go idle like a real user would
        await page.waitForFunction(() => !document.documentElement.classList.contains('chat-busy'), { timeout: 20000 });
        await sleep(300);
        const restBg = await page.evaluate(() => getComputedStyle(document.getElementById('btn-roster-cal')).backgroundColor);
        await (await page.$('#btn-roster-cal')).tap();
        await sleep(300);
        // the reopen glide must land before the tag is tappable
        await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden') && !document.getElementById('ca-rc-tag').classList.contains('hidden') && document.getElementById('ca-rc-tag').getBoundingClientRect().top > 0, { timeout: 8000 });
        await sleep(400);
        ok(await page.evaluate((before) => getComputedStyle(document.getElementById('btn-roster-cal')).backgroundColor === before, restBg), 'hotfix: a finger tap settles back to rest — no sticky hover wash');
        await (await page.$('#ca-rc-tag')).tap();
        // hardening (round 27, owner-approved class + poll): the tap flips
        // ca-rc-tagon instantly (index.html:4803), but the button carries
        // Tailwind's transition-colors (150ms, index.html:1703) so the
        // computed colour FADES to gold — under main-thread jank the fixed
        // sleep(300) raced the fade and false-failed with the class
        // correctly present. Assert the logical state first, then poll the
        // gold to settled (bounded 2s, caught — a timeout is a real CSS
        // failure reported as a failed check, never a rig crash).
        ok(await page.evaluate(() => document.getElementById('ca-rc-tag').classList.contains('ca-rc-tagon')), 'hotfix: the toggle is exempt — the on-state class survives the release');
        ok(await page.waitForFunction(() => getComputedStyle(document.getElementById('ca-rc-tag')).backgroundColor === 'rgb(201, 162, 39)', { timeout: 2000 }).then(() => true, () => false), 'hotfix: the toggle is exempt — the on-state gold settles (bounded poll)');
        await page.evaluate(() => document.getElementById('ca-rc-close').click());
        await sleep(400);
        await page.evaluate(() => { localStorage.removeItem('crewAssist.dutyDays'); localStorage.removeItem('crewAssist.allFlights'); });

        // round 18 (improvement #5): the five flight-verification actions ride
        // data-fv-* + one delegated document listener — a real finger tap on
        // Today must reach it. (The card's tail carries a pre-existing BARE
        // lucide.createIcons() — one of the audit's unguarded calls — which
        // throws once in this CDN-blocked browser AFTER the card is mounted;
        // caught here so the health pins below measure the app, not that
        // known-and-out-of-scope fragility.)
        await page.evaluate(() => { try { renderFlightVerificationCard('menu'); } catch (e) {} });
        // html.chat-busy locks every chat button under pointer-events:none while
        // the typing queue runs (hotfix 12) — a real tap on a pointer-dead
        // button never reaches the listener. The queue also pauses BETWEEN
        // messages, so one wait isn't enough: wait for idle, confirm it STAYS
        // idle 700ms, then tap.
        for (;;) {
            await page.waitForFunction(() => !document.documentElement.classList.contains('chat-busy'), { timeout: 20000 });
            await sleep(700);
            if (await page.evaluate(() => !document.documentElement.classList.contains('chat-busy'))) break;
        }
        await (await page.$('[data-fv-act=today]')).tap();
        await sleep(300);
        ok(await page.evaluate(() => {
            const b = document.querySelector('[data-fv-act=today]');
            const uid = b.getAttribute('data-fv-id');
            return document.getElementById('fv-selected-date-' + uid).value === todayLocalYMD() && b.classList.contains('selected-date');
        }), 'round 18: a real tap on the Today pill answers through the delegated listener — date stamped, pill selected');

        console.log('— round 31: the two-tier feed in the real browser —');
        // Seed a flight tomorrow and refresh through the real entry point —
        // online, chat tab active, so the nudge gate opens.
        await page.evaluate(() => {
            const t = new Date(Date.now() + 86400000);
            const ymd = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
            localStorage.setItem('crewAssist.upcoming', JSON.stringify({ [ymd.slice(0, 7)]: [{ fn: '316', dep: 'SIN', arr: 'CMB', ymd, std: '0930' }] }));
            refreshNextFlightUi();
        });
        await page.waitForFunction(() => !!document.getElementById('ca-menunudge-card') && !!document.getElementById('ca-nextflight-card'), { timeout: 8000 });
        ok(await page.evaluate(() => document.getElementById('ca-menunudge-card').className.indexOf('mt-4') !== -1 && document.getElementById('ca-menunudge-card').className.indexOf('mt-2') === -1), 'the nudge rides its own message row, not the flight card cluster (hotfix 2)');
        ok(await page.evaluate(() => {
            const hero = document.querySelector('#ca-nextflight-card .ca-hero-card');
            const nudge = document.querySelector('#ca-menunudge-card .ca-nudge-card');
            if (!hero || !nudge) return false;
            const hs = getComputedStyle(hero), ns = getComputedStyle(nudge);
            return hs.backgroundImage !== 'none' && hs.borderRadius !== ns.borderRadius;
        }), 'round 31: the hero fills with a gradient, the nudge stays flat, and their radii differ (two tiers)');
        // Both themes are a hard acceptance criterion: the computed hero +
        // nudge fills must shift with the dark class (real var() resolution).
        ok(await page.evaluate(() => {
            const h = document.documentElement;
            const read = () => {
                const hero = getComputedStyle(document.querySelector('#ca-nextflight-card .ca-hero-card'));
                const nudge = getComputedStyle(document.querySelector('#ca-menunudge-card .ca-nudge-card'));
                return [hero.backgroundColor, hero.backgroundImage, hero.borderTopLeftRadius, nudge.backgroundColor, nudge.borderTopLeftRadius].join('|');
            };
            const wasDark = h.classList.contains('dark');
            h.classList.remove('dark');
            const light = read();
            h.classList.add('dark');
            const dark = read();
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return light !== dark;
        }), 'round 31: both themes carry the pair — hero + nudge computed fills shift with the dark class');
        ok(await page.evaluate(() => !!document.querySelector('#ca-nextflight-card .ca-hero-edge') && getComputedStyle(document.querySelector('#ca-nextflight-card .ca-hero-edge')).height === '2px'), 'round 31: the gold top edge rides the hero (computed 2px)');
        // v1.45.37 (owner order, the crisp-edges release): the padding
        // symmetry pin, computed in the real browser - all four sides
        // equal (the class is p-4, this proves it resolves to 16px each)
        ok(await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector('#ca-nextflight-card .ca-hero-card'));
            return cs.paddingTop === cs.paddingBottom && cs.paddingLeft === cs.paddingRight && cs.paddingTop === cs.paddingLeft && cs.paddingTop === '16px';
        }), 'v1.45.37: the flight status card sits symmetric - all four computed paddings equal (16px)');
        // the light-mode shadow diet, computed live: flip to light, read an
        // action chip (a glass-panel), flip back to dark and read again -
        // light must wear the tight navy shadow, dark keeps the long one
        ok(await page.evaluate(() => {
            const h = document.documentElement;
            const read = () => getComputedStyle(document.querySelector('#action-chips .action-chip')).boxShadow;
            const wasDark = h.classList.contains('dark');
            h.classList.remove('dark');
            const light = read();
            h.classList.add('dark');
            const dark = read();
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return /rgba\(11, 26, 58, 0\.06\)/.test(light) && light.indexOf('12px') !== -1 && dark.indexOf('30px') !== -1 && dark !== light;
        }), 'v1.45.37: light mode wears the shadow diet - a tight 12px blur tinted SIA navy - while dark keeps its long 30px shadow (the grey smudge on cream dies)');
        // the dark hairline bump, computed live: in dark, the chip's glass
        // border reads exactly 8% white
        ok(await page.evaluate(() => {
            const h = document.documentElement;
            const wasDark = h.classList.contains('dark');
            h.classList.add('dark');
            const bc = getComputedStyle(document.querySelector('#action-chips .action-chip')).borderColor;
            if (wasDark) h.classList.add('dark'); else h.classList.remove('dark');
            return bc === 'rgba(255, 255, 255, 0.08)';
        }), 'v1.45.37: dark hairlines read at 8% white - the Linear/Raycast grade, cards regain their edge over the aurora');
        // round 32: the nudge is a fixture — losing signal must never strip it
        await page.setOfflineMode(true);
        await page.evaluate(() => refreshNextFlightUi());
        ok(await page.evaluate(() => !!document.getElementById('ca-menunudge-card')), 'round 32: going offline in the real browser never strips the live nudge');
        await page.setOfflineMode(false);

        console.log('— v1.44.2: the date picker navigates like the calendar —');
        // A real card's date button opens the picker; a REAL mouse drag on
        // the day grid glides the month across (the calendar's own swipe),
        // and the arrow keys walk it back.
        await page.evaluate(() => renderCalculatorCard('both'));
        // the card's sector fields mount a tick after the card itself, so
        // the wait is on the date button — and the last card is picked by
        // hand (:last-of-type lies once non-card divs follow it in the
        // chat); the real gesture under test is the drag on the grid, not
        // this opener
        await page.waitForFunction(() => { const cs = document.querySelectorAll('#chat-container [data-calc-card]'); const c = cs[cs.length - 1]; return !!(c && c.querySelector('.ca-date-btn')); }, { timeout: 10000 });
        await page.evaluate(() => { const cs = document.querySelectorAll('#chat-container [data-calc-card]'); const b = cs[cs.length - 1].querySelector('.ca-date-btn'); b.click(); });
        await page.waitForFunction(() => !document.getElementById('cadate-backdrop').classList.contains('hidden'), { timeout: 10000 });
        const pickerMonth = () => page.evaluate(() => document.getElementById('cadate-month').textContent);
        const beforeMonth = await pickerMonth();
        const gc = await page.evaluate(() => { const r = document.getElementById('cadate-grid').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await page.mouse.move(gc.x, gc.y);
        await page.mouse.down();
        await page.mouse.move(gc.x - 160, gc.y, { steps: 8 });
        // the v1.44.3 lesson: a present track is not a VISIBLE track. While
        // the drag is HELD, the real browser must actually paint the gliding
        // months — the grid stands down to a block layer, the track is three
        // grid-widths wide, the middle third sits under the finger's offset,
        // and the finger point hit-tests inside the track.
        const held = await page.evaluate((cx, cy) => {
            const grid = document.getElementById('cadate-grid');
            const track = grid.querySelector('.ca-date-track');
            if (!track) return null;
            const gr = grid.getBoundingClientRect(), tr = track.getBoundingClientRect();
            const mid = track.children[1].getBoundingClientRect();
            const day = track.children[1].querySelector('.cadate-day');
            const dr = day ? day.getBoundingClientRect() : null;
            const hit = document.elementFromPoint(cx, cy);
            const ts = getComputedStyle(track);
            return { area: ts.gridArea, justifySelf: ts.justifySelf, trackW: Math.round(tr.width), gridW: Math.round(gr.width), midLeft: Math.round(mid.left), gridLeft: Math.round(gr.left), midH: Math.round(mid.height), gridH: Math.round(gr.height), dayW: dr ? Math.round(dr.width) : 0, hitInTrack: !!(hit && (hit === track || track.contains(hit))), hitTag: hit ? (hit.tagName + '.' + (typeof hit.className === 'string' ? hit.className : '')) : 'null', trackLeft: Math.round(tr.left) };
        }, gc.x, gc.y);
        ok(held && held.area === '1 / 1 / -1 / -1' && held.justifySelf === 'start', 'while held, the track spans the whole 7x6 grid pinned to start (the v1.44.3 fix)');
        ok(held && Math.abs(held.trackW - held.gridW * 3) <= 6, 'while held, the track is three grid-widths wide');
        ok(held && Math.abs(held.midH - held.gridH) <= 2, 'while held, the gliding month keeps the resting grid\u2019s height');
        ok(held && Math.abs(held.midLeft - (held.gridLeft - 160)) <= 5, 'while held, the middle month sits exactly under the finger\u2019s offset (mid ' + (held && held.midLeft) + ' vs ' + (held && (held.gridLeft - 160)) + ')');
        ok(held && held.dayW >= 20, 'while held, the gliding month carries real day cells (' + (held && held.dayW) + 'px wide)');
        ok(held && held.hitInTrack, 'while held, the finger point hit-tests inside the track \u2014 months are painted under it, not clipped away (hit ' + (held && held.hitTag) + ')');
        await page.mouse.up();
        await sleep(500);
        ok((await pickerMonth()) !== beforeMonth, 'a real mouse drag on the day grid changes the month — the calendar\u2019s swipe, picker edition');
        await page.keyboard.press('ArrowLeft');
        await sleep(150);
        ok((await pickerMonth()) === beforeMonth, 'ArrowLeft walks the picker back a month');
        await page.evaluate(() => document.getElementById('cadate-cancel').click());
        await sleep(400);

        console.log('— v1.45.11: Monthly Salary in the real browser —');
        // Seed a small archive, open the earnings sheet through its real
        // entry point, flip the lens to Monthly Salary. The smoke profile
        // carries no basic salary, so the card must ask - never guess.
        await page.evaluate(() => {
            localStorage.setItem('crewAssist.archive', JSON.stringify([
                { id: 'sal0', savedAt: '2025-09-15T10:00:00Z', monthKey: '2025-09', sectorDate: '2025-09-15', stationDisplay: 'SIN/BKK', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } },
                { id: 'sal1', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'SIN/KUL', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } }
            ]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        ok(await page.evaluate(() => document.getElementById('ca-arch-total-label').textContent === 'Total earnings'), 'the earnings sheet opens in COP mode');
        ok(await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="month"]').classList.contains('ca-arch-segon') && !document.querySelector('.ca-arch-seg[data-scope="all"]').classList.contains('ca-arch-segon')), 'v1.45.13: a fresh open lands on Month, the new default');
        ok(await page.evaluate(() => !document.getElementById('ca-arch-coprow') && !document.querySelector('.ca-arch-copseg')), 'v1.45.13: the IFA/LMA counting row is gone');
        // a DOM-level click: renderArch re-renders the summary, and a
        // geometry-based click can race the node swap mid-render
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        await sleep(300);
        ok(await page.evaluate(() => !document.getElementById('ca-arch-salary-prompt').classList.contains('hidden')), 'without a basic salary the card asks, it never guesses');
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').textContent === '\u2014'), 'the net number stays an em dash until the basic is set');
        // give the profile a basic and re-enter through the app's own reload
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('crewAssist.profile'));
            p.basicSalary = 2600;
            localStorage.setItem('crewAssist.profile', JSON.stringify(p));
            closeArchOverlay(); initData();
        });
        await sleep(300);
        await page.evaluate(() => showArchiveOverlay());
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        // v1.45.56 (owner order) + v1.48.0: a fresh open of the earnings card
        // rolls the big number ONCE THE SHEET IS UP (~360ms) — and so does
        // the lens change below. The numflip cross-fade is retired; the roll
        // owns the figure change
        await sleep(460);
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').querySelectorAll('.ca-rollc').length > 0), 'v1.45.56 + v1.48.0: a fresh earnings open rolls the big number once the sheet is up');
        ok(await page.evaluate(() => { const metas = document.querySelectorAll('#ca-arch-summary .ca-arch-metagrid:not(.hidden) .ca-arch-metaval'); const rolling = Array.from(metas).filter((c) => c.querySelectorAll('.ca-rollc').length > 0).length; const truthy = Array.from(metas).every((c) => !/\d/.test(c.textContent) || c.querySelector('.ca-rollc')); return metas.length >= 2 && rolling >= 2 && truthy; }), 'v1.45.57 hotfix (owner order): the metric quadrant row rolls WITH the big number — every figure in the gold card, each already reading its truth mid-roll');
        ok(await page.evaluate(() => { const cells = Array.from(document.querySelectorAll('#ca-arch-summary .ca-rollc')); const hosts = new Set(cells.map((c) => c.parentElement)); return cells.length > 0 && hosts.size > 0 && Array.from(hosts).every((h) => h.classList.contains('ca-rollwrap')); }), 'v1.45.59 (owner report): every reel cell rides inside its .ca-rollwrap run — one flex item per run, the digits never space out mid-roll');
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').querySelectorAll('.ca-rollc').length > 0), 'v1.45.56 (owner order): a lens change rolls the big number again');
        await sleep(400);
        // two tracked months: gross = 2x(2600+125+340) + 200 = 6330;
        // cpf = .2x(2x2600 + 200) = 1080; net = 5250
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').textContent === '$5,250.00'), 'with a basic set the net computes: gross 6330 - CPF 1080 = 5250');
        await sleep(600);
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').querySelectorAll('.ca-rollc').length === 0 && document.getElementById('ca-arch-total').textContent === '$5,250.00'), 'v1.45.56 (owner order): the earnings roll settles — reels unwrapped, the truth unchanged');
        ok(await page.evaluate(() => document.querySelectorAll('#ca-arch-summary .ca-arch-metagrid:not(.hidden) .ca-arch-metaval .ca-rollc').length === 0), 'v1.45.57 hotfix: the quadrant row settles with the card — every reel unwrapped');
        ok(await page.evaluate(() => document.querySelectorAll('#ca-arch-summary .ca-rollwrap').length === 0), 'v1.45.59: the wrappers unwrap with the reels — the plain markup returns');
        ok(await page.evaluate(() => document.getElementById('ca-arch-avglab').textContent.indexOf('Avg $') === 0), 'the chart paints its average line label');
        await page.evaluate(() => { closeArchOverlay(); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); });

        console.log('— v1.47.1: the capture engine, hand-painted and network-free —');
        // v1.47.1 (owner order — earnings on the passport pattern): the
        // painter library is GONE whole — no vendor script, no boot
        // prewarm, no clone-diet predicate. Both cameras hand-paint the
        // live DOM; the only one-time cost left is the font arm, which
        // rides the first capture itself
        ok(await page.evaluate(() => typeof window.caCapPrewarm === 'undefined' && typeof window.caCapIgnore === 'undefined' && typeof window.html2canvas === 'undefined' && !document.querySelector('div[style*="left:-9999px"]')), 'v1.47.1: the painter engine is gone — no vendor script ever loaded, no prewarm throwaway, nothing offscreen (the print sheet’s own exporter stays lazy and untouched)');

        console.log('— v1.46.0: the earnings camera — year picker, pose, capture, restore —');
        // v1.47.1 (owner order — earnings on the passport pattern): the
        // camera opens the year picker (the archive's own sub-sheet), a
        // pick poses the card to that year, and the canvas HAND-PAINTS the
        // FULL scroll — the roster walker over the live DOM, the diet rows
        // hidden live for the measure + paint (restored in the finally),
        // the title band painted above — and the user's own pills return.
        await page.evaluate(() => {
            localStorage.setItem('crewAssist.archive', JSON.stringify([
                { id: 'cam0', savedAt: '2025-06-15T10:00:00Z', monthKey: '2025-06', sectorDate: '2025-06-15', stationDisplay: 'SIN/BKK', amount: 120, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 120, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 120, sectors: [], stations: [] } },
                { id: 'cam4', savedAt: '2025-09-15T10:00:00Z', monthKey: '2025-09', sectorDate: '2025-09-15', stationDisplay: 'SIN/PNH', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } },
                { id: 'cam5', savedAt: '2025-11-20T10:00:00Z', monthKey: '2025-11', sectorDate: '2025-11-20', stationDisplay: 'SIN/CGK', amount: 150, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 150, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 150, sectors: [], stations: [] } },
                { id: 'cam1', savedAt: '2026-03-15T10:00:00Z', monthKey: '2026-03', sectorDate: '2026-03-15', stationDisplay: 'SIN/KUL', amount: 80, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 80, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 80, sectors: [], stations: [] } },
                { id: 'cam2', savedAt: '2026-06-15T10:00:00Z', monthKey: '2026-06', sectorDate: '2026-06-15', stationDisplay: 'SIN/DPS', amount: 120, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 120, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 120, sectors: [], stations: [] } },
                { id: 'cam3', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'SIN/HKT', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } }
            ]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await sleep(1400);   // the fresh open's roll settles before the camera taps
        ok(await page.evaluate(() => !!document.getElementById('ca-arch-cam') && document.getElementById('ca-arch-cam').querySelector('i[data-lucide="camera"]')), 'v1.46.1: the camera button sits in the earnings header carrying the camera icon');
        // a distinctive user state: All-time + Monthly Salary — the capture
        // must return to exactly here
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        await sleep(1200);
        await page.evaluate(() => document.getElementById('ca-arch-cam').click());
        await sleep(500);
        ok(await page.evaluate(() => !document.getElementById('ca-arch-sub').classList.contains('hidden') && document.getElementById('ca-arch-sub-title').textContent === 'Capture earnings'), 'the camera opens the year picker in the archive\u2019s own sub-sheet');
        ok(await page.evaluate(() => { const rows = Array.from(document.querySelectorAll('#ca-arch-sub-body .ca-cap-yearrow')); return rows.length === 2 && rows[0].getAttribute('data-yr') === '2026' && rows[1].getAttribute('data-yr') === '2025' && !rows.some((r) => /all/i.test(r.textContent)); }), 'the picker lists the years on record, newest first — NO all-time row (the owner\u2019s ruling)');
        await page.evaluate(() => {
            // v1.47.1: the capture is fast enough that the whole pose-and-
            // restore can complete inside one rAF poll — the pose is read
            // from INSIDE a builder wrapper (synchronous, race-free): the
            // posed scrollHeight, the diet rows' display, the roll guard
            window.__caLastShot = null; window.__posedScrollH = 0; window.__posedDiet = null; window.__posedReduced = false; window.__posedClip = null;
            window.__basc = buildArchShotCanvas;
            buildArchShotCanvas = function (el) {
                window.__posedScrollH = el.scrollHeight;
                window.__posedReduced = document.documentElement.classList.contains('ca-reduced');
                window.__posedDiet = ['ca-arch-pillrow-mode', 'ca-arch-pillrow-scope', 'ca-arch-searchrow', 'ca-arch-ins-toggle', 'ca-arch-insights', 'ca-arch-end', 'ca-arch-since'].map((id) => { const n = document.getElementById(id); return n ? n.style.display : 'missing'; });
                // v1.48.0: the roll no longer answers ca-reduced (the one
                // exception) — the capture's own caRollHold stands the digits
                // down, and the pose proves it: no reel cells at build time
                window.__posedRollc = !!el.querySelector('.ca-rollc');
                // v1.47.2: the fold probes, read at build time — the owner
                // saw "a lot of the stations rendering in the bottom month
                // details": a folded month is max-height 0 + overflow
                // hidden + opacity 0, a CLIP not a display none, so its
                // rows still lay out with live rects. The walker must read
                // them as off the screen; the heads must not.
                const foldRow = el.querySelector('.ca-arch-collapsed .ca-arch-row');
                const heads = Array.from(el.querySelectorAll('.ca-arch-group-head'));
                const elTop = el.getBoundingClientRect().top;
                window.__posedClip = {
                    laidOut: el.querySelectorAll('.ca-arch-row').length,
                    folded: el.querySelectorAll('.ca-arch-collapsed .ca-arch-row').length,
                    foldedClip: foldRow ? rosterShotClippedAway(foldRow, el, foldRow.getBoundingClientRect()) : null,
                    headClip: heads.length ? rosterShotClippedAway(heads[0], el, heads[0].getBoundingClientRect()) : null,
                    lastHeadBottom: heads.length ? Math.max.apply(null, heads.map((h) => h.getBoundingClientRect().bottom)) - elTop : -1
                };
                // the walk's own paint set, recomputed with the walker's
                // exact skips — how many station rows will actually paint
                window.__posedWalkRows = Array.from(el.querySelectorAll('.ca-arch-row')).filter((n) => {
                    const st = window.getComputedStyle(n);
                    if (st.display === 'none' || st.visibility === 'hidden') return false;
                    const r = n.getBoundingClientRect();
                    if (r.width < 1 || r.height < 1) return false;
                    if (rosterShotClippedAway(n, el, r)) return false;
                    return true;
                }).length;
                return window.__basc(el);
            };
            Array.from(document.querySelectorAll('#ca-arch-sub-body .ca-cap-yearrow'))[1].click();
        });
        await page.waitForFunction(() => !!window.__caLastShot, { timeout: 15000 });
        ok(await page.evaluate(() => window.__caLastShot.name === 'CrewAssist-Earnings-2025.png' && window.__caLastShot.size > 4000), 'v1.46.1: picking 2025 delivers a real PNG named app + year');
        ok(await page.evaluate(() => window.__posedReduced === true && window.__posedDiet.every((v) => v === 'none')), 'v1.47.1 + v1.48.0: the pose read from inside the build — the reduced guard on, all seven diet rows hidden live (pills, search, insights, the end-of-records line, the since-line)');
        ok(await page.evaluate(() => window.__posedRollc === false), 'v1.48.0: the digits paint SETTLED — the roll plays regardless of ca-reduced now, and the capture\'s own hold stands it down for the pose');
        // v1.47.2 (owner report — "alot of the stations rendering in the
        // bottom month details"): the fold is a clip, not a display none —
        // the folded rows still lay out, so the contract is the walker's
        // ancestor test, read at build time
        ok(await page.evaluate(() => window.__posedClip && window.__posedClip.folded > 0 && window.__posedClip.folded === window.__posedClip.laidOut && window.__posedClip.foldedClip === true && window.__posedClip.headClip === false && window.__posedWalkRows === 0), 'v1.47.2: every station row sits inside a folded month, reads CLIPPED AWAY at build time, and is absent from the walk—s own paint set — the month heads are not (the ghost stations are off the screen, so they are off the canvas)');
        ok(await page.evaluate(async () => {
            // v1.47.2: the raster side of the same report — below the last
            // record a leaked folded row is a full-width band: route at the
            // left wing, amount + delete glyph at the right.
            // v1.48.0 (owner order): the since-line ("Showing earnings
            // since…") joined the diet — the share ends at the last record —
            // so the zone below the last head carries NO ink at all, full
            // width. Text ink is >40 off the surface; the group boxes' wash
            // never reaches it.
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            const bg = document.documentElement.classList.contains('dark') ? [6, 9, 17] : [247, 243, 236];
            const zoneTop = Math.round(window.__posedClip.lastHeadBottom) + 34 + 8;
            for (let y = zoneTop; y < c.height - 6; y++) {
                for (let px = 2; px < c.width - 2; px++) {
                    const i = (y * c.width + px) * 4;
                    if (Math.abs(data[i] - bg[0]) > 40 || Math.abs(data[i + 1] - bg[1]) > 40 || Math.abs(data[i + 2] - bg[2]) > 40) return false;
                }
            }
            return c.height - 6 > zoneTop;
        }), 'v1.47.2 + v1.48.0: below the last record the PNG is EMPTY — no station bands, and no since-line either (the share ends at the last record, and the folded months stay folded)');
        ok(await page.evaluate(async () => {
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            const seen = new Set();
            for (let i = 0; i < data.length; i += 40) seen.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
            // v1.47.1: no trimmer exists — the canvas IS the posed
            // scroll's own height, so the last painted row must sit near
            // the bottom (the scroll's own padding), never a huge gap
            const bg = document.documentElement.classList.contains('dark') ? [6, 9, 17] : [247, 243, 236];
            const rowHasPaint = (y) => { for (let px = 0; px < c.width; px += 3) { const i = (y * c.width + px) * 4; if (Math.abs(data[i] - bg[0]) > 8 || Math.abs(data[i + 1] - bg[1]) > 8 || Math.abs(data[i + 2] - bg[2]) > 8) return true; } return false; };
            let lastPaint = -1;
            for (let y = c.height - 1; y >= 0; y--) { if (rowHasPaint(y)) { lastPaint = y; break; } }
            const tailClean = lastPaint !== -1 && (c.height - lastPaint) <= 60;
            return seen.size > 8 && bmp.width > 200 && bmp.height > 700 && tailClean;
        }), 'v1.46.1: the earnings capture decodes TALL and richly painted, ending at the posed content\u2019s own bottom — the year card + chart + folded list (no header-only crop, no huge gap)');
        // v1.47.1: the canvas IS the posed card — the full scroll's own
        // height plus the 34px title band, at the scroll's live width. The
        // old defect class (a clone mis-measuring live bounds, the canvas
        // cut ~200px before the content's end) is structurally gone: the
        // walker paints at live rects against the scroll's own origin
        ok(await page.evaluate(async () => {
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const r = document.getElementById('ca-arch-scroll').getBoundingClientRect();
            return Math.abs(bmp.width - r.width) <= 2 && Math.abs(bmp.height - (window.__posedScrollH + 34)) <= 4;
        }), 'v1.47.1: the earnings capture IS the posed scroll — full height + the title band, exact width (no viewport-bounded cut, no trim air)');
        // v1.46.2 (the owner's real-device report): the capture must print
        // in the app's OWN typeface. The faces arm in the LIVE head before
        // the shot (caCapFontArm), the clone inherits them — and the proof
        // compares the painted width of the injected header against a
        // hidden twin of the same string in the live document: a fallback
        // font would miss by many pixels
        ok(await page.evaluate(() => {
            const st = document.getElementById('ca-cap-fonts');
            if (!st || st.textContent.indexOf('@font-face') === -1) return false;
            return document.fonts.check('700 16px "Plus Jakarta Sans"') && document.fonts.check('400 16px "Plus Jakarta Sans"');
        }), 'v1.46.2: the capture armed the house font in the live document — the data-URL faces resolve and the clone inherits true metrics');
        ok(await page.evaluate(async () => {
            // v1.47.1 (owner order — include the header): the title band
            // carries "Earnings for 2025", painted by caCapPaintTitle in
            // the armed house typeface — the ink run's width vs a canvas
            // measure of the same string (a fallback would miss by pixels)
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            let hMin = 1e9, hMax = -1;
            for (let y = 4; y < Math.min(30, c.height); y++) {
                const row = [];
                for (let px = 0; px < c.width; px++) { const i = (y * c.width + px) * 4; row.push(data[i] + ',' + data[i + 1] + ',' + data[i + 2]); }
                row.sort();
                const med = row[Math.floor(row.length / 2)].split(',').map(Number);
                for (let px = 6; px < c.width - 6; px++) {
                    const i = (y * c.width + px) * 4;
                    if (Math.abs(data[i] - med[0]) > 40 || Math.abs(data[i + 1] - med[1]) > 40 || Math.abs(data[i + 2] - med[2]) > 40) { if (px < hMin) hMin = px; if (px > hMax) hMax = px; }
                }
            }
            const tw = document.createElement('canvas').getContext('2d');
            tw.font = '700 18px "Plus Jakarta Sans", sans-serif';
            const want = tw.measureText('Earnings for 2025').width;
            const headW = (hMax >= hMin) ? hMax - hMin + 1 : -1;
            return headW > 0 && Math.abs(headW - want) <= 4;
        }), 'v1.47.1 (owner order): the title band carries "Earnings for 2025" — painted in the armed house typeface, centered over the card');
        ok(await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').classList.contains('ca-arch-segon') && document.querySelector('.ca-arch-seg[data-mode="salary"]').classList.contains('ca-arch-segon') && document.querySelectorAll('#ca-arch-summary .ca-rollwrap').length === 0 && !document.documentElement.classList.contains('ca-reduced')), 'v1.46.1: the user\u2019s own pills return exactly — All-time + Monthly Salary, no roll guard, nothing stranded');
        ok(await page.evaluate(() => !!document.getElementById('ca-arch-ins-toggle') && !!document.getElementById('ca-arch-pillrow-mode') && document.getElementById('ca-arch-pillrow-mode').style.display !== 'none' && document.getElementById('ca-arch-sub').classList.contains('hidden')), 'the LIVE page kept its search bar, pills and insights toggle — the diet rows are back for real, not display:none');
        ok(await page.evaluate(() => document.getElementById('ca-arch-scroll').scrollHeight >= window.__posedScrollH + 60), 'v1.47.1: the live scroll grows back past its captured height — the diet rows (pills, search, insights) were hidden for the paint and returned after it');
        // v1.46.1 (the owner's missing-chart report): the CURRENT year must
        // paint its chart — the pose re-render restarts the bar-grow
        // entrance, and ca-reduced now stands it down for the capture
        await page.evaluate(() => { window.__caLastShot = null; document.getElementById('ca-arch-cam').click(); });
        await sleep(500);
        await page.evaluate(() => document.querySelector('#ca-arch-sub-body .ca-cap-yearrow[data-yr="2026"]').click());
        await page.waitForFunction(() => !!window.__caLastShot, { timeout: 15000 });
        ok(await page.evaluate(() => window.__caLastShot.name === 'CrewAssist-Earnings-2026.png'), 'v1.46.1: picking the current year delivers its PNG');
        ok(await page.evaluate(async () => {
            const bmp = await createImageBitmap(window.__caLastShot.blob);
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
            const data = x.getImageData(0, 0, c.width, c.height).data;
            // the chart zone sits between the summary card and the list:
            // scan the middle for the gold bars (r>150, g>105, b<120, r>g>b)
            // — scaleY(0) bars would leave the zone near-empty
            let gold = 0;
            const y0 = Math.round(c.height * 0.3), y1 = Math.round(c.height * 0.62);
            for (let y = y0; y < y1; y++) for (let px = 0; px < c.width; px += 2) {
                const i = (y * c.width + px) * 4;
                if (data[i] > 150 && data[i + 1] > 105 && data[i + 2] < 120 && data[i] > data[i + 1] && data[i + 1] > data[i + 2]) gold++;
            }
            return gold > 800;
        }), 'v1.46.1 (the owner\u2019s 2026 report): the current year\u2019s chart PAINTS — its gold bars ride the capture at full height (the bar-grow entrance stands down under the pose guard)');
        // v1.46.4 (owner report — 15-20s captures): the capture flows must
        // never await the network-bound document.fonts.ready — it waits on
        // EVERY live face including the cross-origin Google ones. Hang it
        // forever and the camera must still deliver inside the normal bound
        {
            await page.evaluate(() => {
                window.__caLastShot = null;
                try { Object.defineProperty(document.fonts, 'ready', { get: () => new Promise(() => {}) }); } catch (e) {}
            });
            await page.evaluate(() => { document.getElementById('ca-arch-cam').click(); });
            await sleep(500);
            await page.evaluate(() => { window.__caLastShot = null; Array.from(document.querySelectorAll('#ca-arch-sub-body .ca-cap-yearrow'))[0].click(); });
            let hungOk = true;
            try { await page.waitForFunction(() => !!window.__caLastShot, { timeout: 15000 }); } catch (e) { hungOk = false; }
            ok(hungOk, 'v1.46.4: with document.fonts.ready hung forever, the camera still delivers — the arm (vendored data-URL faces) replaced the network-bound wait');
            await page.evaluate(() => { try { delete document.fonts.ready; } catch (e) {} });
        }
        // v1.46.6 (owner order — "when i mean share i mean the native ios
        // and android web share pop up"): the capture hands its PNG
        // straight to navigator.share the moment it exists. A refusal
        // that is not the crew's own dismissal still anchors the file;
        // the dismissal never downloads; without a share API the anchor
        // is the door (desktop). Every path ends on its done toast.
        {
            ok(await page.evaluate(() => !document.getElementById('ca-cap-preview')), 'v1.46.6: the earnings capture leaves no preview — the delivery ran straight off the paint');
            const r = await page.evaluate(async () => {
                const blob = window.__caLastShot && window.__caLastShot.blob;
                if (!blob) return null;
                const out = {};
                let anchors = 0;
                const mk = document.createElement.bind(document);
                document.createElement = function (t) { const el = mk(t); if (t === 'a') { el.click = function () { anchors++; }; } return el; };
                try {
                    navigator.canShare = () => true;
                    navigator.share = () => Promise.reject(Object.assign(new Error('activation window lapsed'), { name: 'NotAllowedError' }));
                    await caCapDeliver(blob, 'probe-a.png', 'CrewAssist', 'Saved A');
                    await new Promise((res) => setTimeout(res, 300));
                    out.lateRefusalAnchor = anchors;
                    out.toastA = (document.querySelector('#ca-arch-toast span') || {}).textContent || '';
                    navigator.share = () => Promise.reject(Object.assign(new Error('dismissed'), { name: 'AbortError' }));
                    await caCapDeliver(blob, 'probe-b.png', 'CrewAssist', 'Saved B');
                    await new Promise((res) => setTimeout(res, 300));
                    out.dismissalAnchor = anchors - out.lateRefusalAnchor;
                    out.toastB = (document.querySelector('#ca-arch-toast span') || {}).textContent || '';
                    delete navigator.canShare; delete navigator.share;
                    await caCapDeliver(blob, 'probe-c.png', 'CrewAssist', 'Saved C');
                    await new Promise((res) => setTimeout(res, 300));
                    out.noApiAnchor = anchors - out.lateRefusalAnchor - out.dismissalAnchor;
                    out.toastC = (document.querySelector('#ca-arch-toast span') || {}).textContent || '';
                } finally {
                    document.createElement = mk;
                    try { delete navigator.canShare; delete navigator.share; } catch (e) {}
                }
                return out;
            });
            ok(r && r.lateRefusalAnchor === 1, 'v1.46.6: a late share refusal (the activation window lapsed mid-capture) falls through to the anchor download — the PNG always lands');
            ok(r && r.toastA === 'Saved A', 'v1.46.6: the refusal path ends on the done toast');
            ok(r && r.dismissalAnchor === 0, 'v1.46.6: the crew’s own dismissal (AbortError) stops at the toast — no stray download');
            ok(r && r.toastB === 'Saved B', 'v1.46.6: the dismissal ends on its toast');
            ok(r && r.noApiAnchor === 1, 'v1.46.6: without a share API the delivery anchors the download exactly once — the desktop door');
            ok(r && r.toastC === 'Saved C', 'v1.46.6: the anchor fallback ends on its toast too');
        }

        await page.evaluate(() => { closeArchOverlay(); localStorage.removeItem('crewAssist.archive'); });

        console.log('— v1.45.12: the earnings card + list polish —');
        // The contrast maths runs where the pixels live: composited inks over
        // the gold gradient's worst-case stops, both themes.
        // seed: a basic + three months (past, live with a future-dated duty,
        // upcoming) so the card, the pills and the money column all render
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const nxt = new Date(now.getFullYear(), now.getMonth() + 1, 15);
            const cur = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS', basicSalary: 2600 }));
            const r1e = ent('r1', cur, 88); r1e.endAt = Date.now() + 6 * 3600 * 1000;   // midnight wall (see the state16 note): stays unflown at any run hour
            const r2e = ent('r2', nxt, 60); r2e.endAt = Date.now() + 30 * 24 * 3600 * 1000;
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('r0', new Date(now.getFullYear() - 1, 8, 15), 100), r1e, r2e]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        // the virtual cursor still sits wherever the calendar drag left it;
        // parked in the corner it cannot hold a :hover over the segs and
        // skew the ink probes below (the segs carry a hover colour)
        await page.mouse.move(2, 2);
        // v1.45.13 default: the fresh open lands on Month (the current
        // month's COP allowance) - then All-time so the pills and money
        // column below see every seeded month
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        ok(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('ca-arch-total')); return cs.paddingTop === '16px' && cs.paddingBottom === '16px'; }), 'v1.45.13: the core figure carries 16px of air above and below');
        const grid3 = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-cop');
            const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat);
            const clips = [...el.children].map((c) => c.scrollWidth > c.clientWidth + 1);
            const vals = [...el.querySelectorAll('.ca-arch-metaval')].map((v) => v.scrollWidth > v.clientWidth + 1);
            const span = el.children[2];
            const gs = getComputedStyle(span);
            return { tracks, clips, vals, span: gs.gridColumnStart === 'span 2' || gs.gridColumnEnd === 'span 2', spanDbg: gs.gridColumnStart + '/' + gs.gridColumnEnd + ' cls=' + span.className };
        });
        ok(grid3.tracks.length === 2 && Math.abs(grid3.tracks[0] - grid3.tracks[1]) <= 1 && !grid3.clips.some(Boolean), 'v1.45.21: the COP stat row rides the unified 2x2 quadrant grid and nothing clips');
        ok(grid3.span === true, 'the COP context cell spans the full bottom row (' + grid3.spanDbg + ')');
        ok(!grid3.vals.some(Boolean), 'stat values never truncate (nowrap, no clip)');
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        await sleep(300);
        const grid4 = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-salary');
            const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat);
            const clips = [...el.children].map((c) => c.scrollWidth > c.clientWidth + 1);
            const vals = [...el.querySelectorAll('.ca-arch-metaval')].map((v) => v.scrollWidth > v.clientWidth + 1);
            const spans = [...el.children].map((c) => getComputedStyle(c).gridColumnStart + '/' + getComputedStyle(c).gridColumnEnd);
            return { tracks, clips, vals, spans };
        });
        ok(grid4.tracks.length === 2 && Math.abs(grid4.tracks[0] - grid4.tracks[1]) <= 1 && !grid4.clips.some(Boolean) && !grid4.vals.some(Boolean), 'v1.45.20: the salary row rides the strict 2x2 quadrant grid and nothing clips');
        ok(grid4.spans.every((sp) => sp === 'auto/auto'), 'no span classes anywhere - every quadrant fills its single track (' + grid4.spans.join(' ') + ')');
        // AA: every readable text on the gold card - inactive tabs (over the
        // pill wash over the gradient's LIGHTEST stop, the worst case for
        // dark ink) and the meta labels (over the DARKEST stop, where the
        // stat grid sits)
        const aaSegFn = () => page.evaluate(() => {
            // headless compositors run colour transitions slowly - snap them
            // to the settled state the crew actually reads
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
            const comp = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            const ratio = (a, b) => { const l1 = Math.max(lum(a), lum(b)), l2 = Math.min(lum(a), lum(b)); return (l1 + 0.05) / (l2 + 0.05); };
            const card = document.getElementById('ca-arch-summary');
            const stops = [...getComputedStyle(card).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]));
            const hi = stops[0], lo = stops[stops.length - 1];
            const wash = parse(getComputedStyle(document.querySelector('.ca-arch-segtrack')).backgroundColor);
            const pillBg = comp(wash, hi);
            const out = { seg: [], label: 0 };
            document.querySelectorAll('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)').forEach((seg) => {
                out.seg.push(ratio(comp(parse(getComputedStyle(seg).color), pillBg), pillBg));
            });
            const lab = document.querySelector('#ca-arch-meta-salary .ca-arch-metalabel') || document.querySelector('#ca-arch-meta-cop .ca-arch-metalabel');
            out.label = ratio(comp(parse(getComputedStyle(lab).color), lo), lo);
            return out;
        });
        // the mode pill inks cross through a .15s colour transition and a
        // probe can land mid-flight under load - sample until it settles
        let aaSeg = await aaSegFn();
        for (let t = 0; t < 10 && (aaSeg.seg.some((r) => r < 4.5) || aaSeg.label < 4.5); t++) {
            await sleep(200);
            const next = await aaSegFn();
            if (JSON.stringify(next) === JSON.stringify(aaSeg)) break;
            aaSeg = next;
        }
        ok(aaSeg.seg.length >= 3 && aaSeg.seg.every((r) => r >= 4.5), 'every inactive tab reads at AA (>=4.5:1) against the gold (worst-case stop, got ' + aaSeg.seg.map((r) => r.toFixed(2)).join('/') + ')');
        ok(aaSeg.label >= 4.5, 'the stat labels read at AA over the darkest gold stop (got ' + aaSeg.label.toFixed(2) + ')');
        // the money column: the rigid two-column tabular grid (v1.45.23)
        const money = await page.evaluate(() => {
            const cols = [...document.querySelectorAll('#ca-arch-list .ca-arch-amt.ca-arch-moneygrid')];
            if (!cols.length) return { none: true };
            const edges = cols.map((c) => {
                const net = c.querySelector('.ca-arch-amt-net'), gross = c.querySelector('.ca-arch-amt-gross');
                const cs = getComputedStyle(c);
                const cells = [...c.children];
                return { pair: Math.abs(net.getBoundingClientRect().right - gross.getBoundingClientRect().right), col: c.getBoundingClientRect().right,
                    disp: cs.display, tracks: cs.gridTemplateColumns.split(' ').length, cgap: parseFloat(cs.columnGap), ac: cs.alignContent, ai: cs.alignItems, jc: cs.justifyContent,
                    wrap: cells.every((x) => getComputedStyle(x).whiteSpace === 'nowrap'), lbl: cells[0].textContent, lblL: cells[0].getBoundingClientRect().left, lbl2L: cells[2].getBoundingClientRect().left, netBold: getComputedStyle(net).fontWeight, netGold: getComputedStyle(net).color, secMut: getComputedStyle(gross).color };
            });
            return { none: false, pair: Math.max(...edges.map((e) => e.pair)), across: Math.max(...edges.map((e) => e.col)) - Math.min(...edges.map((e) => e.col)), disp: edges.every((e) => e.disp === 'grid'), tracks: edges.every((e) => e.tracks === 2), cgap: edges.every((e) => Math.abs(e.cgap - 8) <= 0.5), ac: edges.every((e) => e.ac === 'center'), ai: edges.every((e) => e.ai === 'baseline'), jc: edges.every((e) => e.jc === 'end'), wrap: edges.every((e) => e.wrap), lbl: edges.every((e) => e.lbl === 'N'), rail: edges.every((e) => Math.abs(e.lblL - e.lbl2L) <= 1), bold: edges.every((e) => e.netBold === '700') };
        });
        ok(!money.none && money.pair <= 1.5 && money.across <= 1.5, 'net and gross ride the grid right-aligned, value edge straight across months (pair ' + (money.pair || 0).toFixed(1) + 'px, across ' + (money.across || 0).toFixed(1) + 'px)');
        ok(money.disp && money.tracks && money.cgap && money.ac && money.ai && money.jc, 'v1.45.23: the money block is the rigid two-column grid - 8px between the rails, baselines paired, rows centred, columns pushed right');
        ok(money.wrap && money.lbl && money.rail, 'every cell never wraps and the single-character tokens sit on one left rail (N leading)');
        ok(money.bold, 'the NET figure carries the strongest weight (700)');
        // v1.45.16 (owner order): the status badges are gone - the state
        // rides Lucide icons (the rig blocks the CDN, so the icons stay <i>
        // stubs; name + class + computed animation are the proof) and the
        // words ride the count line. The active pill gets its colours
        // measured in BOTH themes here - the daylight walnut-on-espresso
        // invisibility was this release's bug
        const stateDark = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const live = document.querySelector('.ca-arch-group-head i[data-lucide="refresh-cw"]');
            const up = document.querySelector('.ca-arch-group-head i[data-lucide="clock-arrow-up"]');
            const on = document.querySelector('#ca-arch-summary .ca-arch-seg.ca-arch-segon');
            const cs = live ? getComputedStyle(live) : null;
            return {
                live: !!live, up: !!up,
                spinName: cs ? cs.animationName : '', spinDur: cs ? cs.animationDuration : '', spinCount: cs ? cs.animationIterationCount : '',
                onBg: on ? getComputedStyle(on).backgroundColor : '', onInk: on ? getComputedStyle(on).color : ''
            };
        });
        ok(stateDark.live && stateDark.up, 'v1.45.16: the live month wears refresh-cw, the future month clock-arrow-up (dark)');
        ok(stateDark.spinName === 'caArchLive' && stateDark.spinDur === '6s' && stateDark.spinCount === 'infinite', 'the live icon spins the slowed 6s ambient loop (' + stateDark.spinName + ' ' + stateDark.spinDur + ' ' + stateDark.spinCount + ')');
        ok(stateDark.onBg === 'rgb(26, 19, 0)' && stateDark.onInk === 'rgb(230, 194, 84)', 'the night active pill keeps its espresso fill and clean gold ink (' + stateDark.onBg + ' / ' + stateDark.onInk + ')');
        const cardLum = await page.evaluate(() => {
            const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2] }; };
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            return { group: lum(parse(getComputedStyle(document.querySelector('.ca-arch-group')).backgroundColor)), sheet: lum(parse(getComputedStyle(document.getElementById('ca-arch-sheet')).backgroundColor)) };
        });
        ok(cardLum.group > cardLum.sheet, 'the month cards sit a shade lighter than the sheet canvas (dark: ' + cardLum.group.toFixed(3) + ' vs ' + cardLum.sheet.toFixed(3) + ')');
        // the light theme: the ACTIVE pill turns white with walnut ink (the
        // 1.45.16 fix) and the tab ink holds its contrast
        await page.evaluate(() => { document.documentElement.classList.remove('dark'); });
        await sleep(300);
        const pillsLight = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const parse2 = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
            const comp2 = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
            const lum2 = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            const ratio2 = (a, b) => { const l1 = Math.max(lum2(a), lum2(b)), l2 = Math.min(lum2(a), lum2(b)); return (l1 + 0.05) / (l2 + 0.05); };
            const stops = [...getComputedStyle(document.getElementById('ca-arch-summary')).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse2(m[0]));
            const wash = parse2(getComputedStyle(document.querySelector('.ca-arch-segtrack')).backgroundColor);
            const pillBg = comp2(wash, stops[0]);
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            const on = document.querySelector('#ca-arch-summary .ca-arch-seg.ca-arch-segon');
            const onBg = parse2(getComputedStyle(on).backgroundColor), onInk = parse2(getComputedStyle(on).color);
            return { onBg: getComputedStyle(on).backgroundColor, onInk: getComputedStyle(on).color, onR: ratio2(comp2(onInk, onBg), onBg), segR: ratio2(comp2(parse2(getComputedStyle(seg).color), pillBg), pillBg) };
        });
        ok(pillsLight.onBg === 'rgb(255, 255, 255)' && pillsLight.onInk === 'rgb(45, 30, 15)', 'v1.45.16: the daylight active pill is crisp white with walnut ink (' + pillsLight.onBg + ' / ' + pillsLight.onInk + ')');
        ok(pillsLight.onR >= 4.5, 'the daylight active pill reads at AA (walnut on white: ' + pillsLight.onR.toFixed(2) + ':1)');
        let segLight = pillsLight.segR;
        for (let t = 0; t < 10 && segLight < 4.5; t++) {
            await sleep(200);
            const next = await page.evaluate(() => {
                document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
                const parse2 = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
                const comp2 = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
                const lum2 = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
                const ratio2 = (a, b) => { const l1 = Math.max(lum2(a), lum2(b)), l2 = Math.min(lum2(a), lum2(b)); return (l1 + 0.05) / (l2 + 0.05); };
                const stops = [...getComputedStyle(document.getElementById('ca-arch-summary')).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse2(m[0]));
                const wash = parse2(getComputedStyle(document.querySelector('.ca-arch-segtrack')).backgroundColor);
                const pillBg = comp2(wash, stops[0]);
                const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
                return ratio2(comp2(parse2(getComputedStyle(seg).color), pillBg), pillBg);
            });
            if (Math.abs(next - segLight) < 0.01) break;
            segLight = next;
        }
        ok(segLight >= 4.5, 'the inactive tabs read at AA in daylight too (got ' + segLight.toFixed(2) + ')');

        console.log('— v1.45.13: the fresh-open earnings, chart mute + future stripes —');
        // still in salary + All-time (Year-by-Year): the legend must show
        ok(await page.evaluate(() => !document.getElementById('ca-arch-legend').classList.contains('hidden')), 'the Year-by-Year legend shows in salary view');
        ok(await page.evaluate(() => { const l = document.getElementById('ca-arch-legend'); return l.textContent.indexOf('Basic Salary') !== -1 && l.textContent.indexOf('Allowances') !== -1; }), 'the legend names both stacked golds');
        const legSw = await page.evaluate(() => {
            const sal = getComputedStyle(document.querySelector('.ca-arch-legsw-sal')).backgroundColor;
            const fly = getComputedStyle(document.querySelector('.ca-arch-legsw-fly')).backgroundColor;
            return { sal, fly };
        });
        ok(legSw.sal === 'rgba(146, 94, 14, 0.45)' && legSw.fly === 'rgba(212, 175, 55, 0.65)', 'the swatches match the bar segments pixel for pixel (' + legSw.sal + ' / ' + legSw.fly + ')');
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="cop"]').click());
        await sleep(300);
        ok(await page.evaluate(() => document.getElementById('ca-arch-legend').classList.contains('hidden')), 'the legend steps aside in COP view');
        // the year window: past bars muted, the empty future striped
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="year"]').click());
        await sleep(300);
        const chartYr = await page.evaluate(() => {
            const bars = [...document.querySelectorAll('#ca-arch-chart .ca-arch-barcol')];
            const active = bars.find((b) => b.classList.contains('ca-arch-baron'));
            const past = bars.find((b) => !b.classList.contains('ca-arch-baron') && b.querySelector('.ca-arch-bar') && !b.querySelector('.ca-arch-bar').classList.contains('ca-arch-barfuture'));
            const fut = bars.map((b) => b.querySelector('.ca-arch-barfuture')).filter(Boolean)[0];
            // the bars grow in over a .4s animation (transform scale), so the
            // geometry rect races it - the inline height is the layout truth
            const out = { pastBg: past ? getComputedStyle(past.querySelector('.ca-arch-bar')).backgroundColor : null, futH: 0, futStriped: false };
            if (fut) { const m = /height:\s*(\d+(?:\.\d+)?)px/.exec(fut.getAttribute('style') || ''); out.futH = m ? parseFloat(m[1]) : 0; const bg = getComputedStyle(fut).backgroundImage; out.futStriped = bg.indexOf('repeating-linear-gradient') !== -1; }
            void active;
            return out;
        });
        ok(chartYr.pastBg === 'rgba(212, 175, 55, 0.65)', 'a non-selected past bar sits at 0.65 alpha - 35% under the selected bar\u2019s solid gold (got ' + chartYr.pastBg + ')');
        ok(chartYr.futH >= 15 && chartYr.futStriped, 'an empty future month renders the 16px striped placeholder (' + chartYr.futH.toFixed(0) + 'px)');
        await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.14: never-future fallback, two-row month meta, ledger grid, daylight depth —');
        // seed: the current month carries a flown + an unflown entry; the
        // next month carries a pre-saved future one (the fallback trap)
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const nxt = new Date(now.getFullYear(), now.getMonth() + 1, 15);
            const cur = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS', basicSalary: 2600 }));
            const d0e = ent('d0', cur, 88); d0e.endAt = Date.now() + 6 * 3600 * 1000;   // midnight wall: the current month keeps its live state
            const d2e = ent('d2', nxt, 40); d2e.endAt = Date.now() + 30 * 24 * 3600 * 1000;
            localStorage.setItem('crewAssist.archive', JSON.stringify([d0e, ent('d1', new Date(now.getFullYear(), now.getMonth(), 2), 60), d2e]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        // the fresh open lands on the CURRENT month - never the pre-saved future one
        const landMk = await page.evaluate(() => {
            const now = new Date();
            const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const heads = [...document.querySelectorAll('.ca-arch-group-head')].map((h) => h.getAttribute('data-mk'));
            return { ym, heads };
        });
        ok(landMk.heads.length === 1 && landMk.heads[0] === landMk.ym, 'v1.45.14: the fresh open lands on the current month (' + landMk.heads.join(',') + ' vs ' + landMk.ym + ')');
        // COP + MONTH: the quadrant architecture - equal halves, hairlines, the milestone full width
        const metaRows = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const el = document.getElementById('ca-arch-meta-cop');
            const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat);
            const ctx = el.children[2];
            const gs = getComputedStyle(ctx);
            const c0 = getComputedStyle(el.children[0]);
            const c1 = getComputedStyle(el.children[1]);
            return { tracks, start: gs.gridColumnStart, end: gs.gridColumnEnd, gap: getComputedStyle(document.getElementById('ca-arch-m-ctx')).columnGap, pad: c0.padding, brw: c0.borderRightWidth, bbw: c0.borderBottomWidth, b1r: c1.borderRightWidth, b1b: c1.borderBottomWidth, w: ctx.getBoundingClientRect().width, elw: el.getBoundingClientRect().width };
        });
        ok(metaRows.tracks.length === 2 && Math.abs(metaRows.tracks[0] - metaRows.tracks[1]) <= 1, 'v1.45.21: COP + Month rides the quadrant 2x2 - the counts pair in equal halves');
        ok((metaRows.start === 'span 2' || metaRows.end === 'span 2') && metaRows.w >= metaRows.elw - 1, 'the milestone spans the full card width on its own bottom row (w ' + metaRows.w.toFixed(0) + ' of ' + metaRows.elw.toFixed(0) + ')');
        ok(metaRows.gap === '8px', 'the bullseye icon keeps gap-x-2 from the milestone text (got ' + metaRows.gap + ')');
        ok(metaRows.pad === '12px' && metaRows.brw === '1px' && metaRows.bbw === '1px' && metaRows.b1r === '0px' && metaRows.b1b === '1px', 'the quadrant padding + axes: Flights pads 12px carrying both hairlines, Avg only the bottom (pad ' + metaRows.pad + ', r ' + metaRows.brw + '/' + metaRows.b1r + ', b ' + metaRows.bbw + '/' + metaRows.b1b + ')');
        // the ledger row grid: value column right-aligned and independent of the ✕ slot
        const rowGrid = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('#ca-arch-list .ca-arch-row')];
            if (!rows.length) return { none: true };
            const amts = rows.map((r) => r.querySelector('.ca-arch-amt').getBoundingClientRect().right);
            const dels = rows.map((r) => r.querySelector('.ca-arch-del').getBoundingClientRect());
            const kids = rows.map((r) => r.children.length);
            const track = getComputedStyle(rows[0]).gridTemplateColumns;
            return { none: false, n: rows.length, spread: Math.max(...amts) - Math.min(...amts), amtRight: amts[0], delLeft: dels[0].left, delW: Math.max(...dels.map((d) => d.width)), kids: kids.every((k) => k === 3), track };
        });
        ok(!rowGrid.none && rowGrid.n >= 2 && rowGrid.spread <= 1, 'v1.45.14: ledger values align down one strict column (spread ' + (rowGrid.spread || 0).toFixed(1) + 'px over ' + (rowGrid.n || 0) + ' rows)');
        ok(rowGrid.kids && rowGrid.amtRight < rowGrid.delLeft - 4, 'the value column ends clear of the fixed ✕ slot - independent of its touch target');
        ok(rowGrid.track.split(' ').length === 3 && /40px/.test(rowGrid.track), 'the row is a three-track grid with the fixed 40px ✕ slot (got ' + rowGrid.track + ')');
        // All-time keeps the same quadrant architecture - no scope ever swaps the grid
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        const metaFlat = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-cop');
            return { cls0: el.children[0].className, tracks: getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat) };
        });
        ok(metaFlat.tracks.length === 2 && metaFlat.cls0.indexOf('ca-arch-msq-r') !== -1, 'All-time keeps the quadrant architecture - the grid never changes with the scope');
        // daylight depth: warm canvas, solid white cards, walnut ink
        await page.evaluate(() => { document.documentElement.classList.remove('dark'); });
        await sleep(300);
        const lightDepth = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const sheet = getComputedStyle(document.getElementById('ca-arch-sheet')).backgroundColor;
            const group = document.querySelector('.ca-arch-group');
            const card = getComputedStyle(group);
            const trend = getComputedStyle(document.getElementById('ca-arch-trend'));
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            return { sheet, groupBg: card.backgroundColor, groupShadow: card.boxShadow, trendBg: trend.backgroundColor, trendShadow: trend.boxShadow, segColor: getComputedStyle(seg).color };
        });
        eq(lightDepth.sheet, 'rgb(244, 244, 240)', 'v1.45.14: the light earnings canvas is the warm gray #F4F4F0');
        eq(lightDepth.groupBg, 'rgb(255, 255, 255)', 'the month cards are solid white by day');
        ok(lightDepth.groupShadow.indexOf('rgba(0, 0, 0, 0.03)') !== -1, 'month cards carry the soft low-blur shadow by day');
        eq(lightDepth.trendBg, 'rgb(255, 255, 255)', 'the trend card stays crisp white by day');
        ok(lightDepth.trendShadow.indexOf('rgba(0, 0, 0, 0.03)') !== -1, 'the trend card carries the shadow too');
        eq(lightDepth.segColor, 'rgb(45, 30, 15)', 'inactive pills read strict walnut #2D1E0F by day (owner-tightened in 1.45.15)');
        // the walnut ink holds AA over the gold wash
        const walnutAA = await page.evaluate(() => {
            const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
            const comp = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            const ratio = (a, b) => { const l1 = Math.max(lum(a), lum(b)), l2 = Math.min(lum(a), lum(b)); return (l1 + 0.05) / (l2 + 0.05); };
            const stops = [...getComputedStyle(document.getElementById('ca-arch-summary')).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]));
            const wash = parse(getComputedStyle(document.querySelector('.ca-arch-segtrack')).backgroundColor);
            const pillBg = comp(wash, stops[0]);
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            return ratio(comp(parse(getComputedStyle(seg).color), pillBg), pillBg);
        });
        ok(walnutAA >= 4.5, 'the walnut ink reads at AA over the gold by day (got ' + walnutAA.toFixed(2) + ':1)');
        await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.15: the roster-aware still-to-fly notice, centred ✕, heavier inks —');
        // the owner's case: the current month's saved entries have all
        // landed, but the ROSTER still has legs ahead; the next month is
        // pre-saved (upcoming)
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const past = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 5, 1));
            const past2 = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 9, 1));
            const nxt = new Date(now.getFullYear(), now.getMonth() + 1, 15);
            // v1.45.39 rig fix (no app change): archMonthState matches an
            // upcoming leg by its OWN ymd month, so a now+3 that spills
            // past the month edge (the last three days of any month -
            // first hit 29 Oct 2026) left the card reading Month complete.
            // The "ahead" legs now ride the month's LAST day with
            // end-of-day STAs, so they stay unlanded for every run hour
            // of the month (the v1.45.24 fixed-walls precedent; only the
            // final minute of the month can see them landed).
            const late = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' }));
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('e0', past, 88), ent('e1', past2, 60), ent('e2', nxt, 40)]));
            localStorage.setItem('crewAssist.upcoming', JSON.stringify({
                [ym(now)]: [
                    { fn: '322', dep: 'SIN', arr: 'AMD', ymd: ymd(late), std: '20:00', sta: '22:00', stdYmd: ymd(late), staYmd: ymd(late) },
                    { fn: '323', dep: 'AMD', arr: 'SIN', ymd: ymd(late), std: '23:00', sta: '23:59', stdYmd: ymd(late), staYmd: ymd(late) }
                ]
            }));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        await sleep(300);
        const rosterNotice = await page.evaluate(() => {
            const now = new Date();
            const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const g = document.querySelector('.ca-arch-group-head[data-mk="' + ym + '"]');
            return { ym, btn: !!(g && g.closest('.ca-arch-group').querySelector('.ca-arch-proj-btn')), ctx: document.getElementById('ca-arch-m-ctx').textContent };
        });
        ok(rosterNotice.btn, 'v1.45.15: the current month carries the still-to-fly notice while its roster has legs ahead');
        ok(rosterNotice.ctx.indexOf('2 roster flights still to fly') !== -1, 'the gold card names the roster flights (not Month complete): ' + rosterNotice.ctx);
        await page.evaluate(() => document.querySelector('.ca-arch-proj-btn').click());
        await sleep(300);
        const rosterPanel = await page.evaluate(() => {
            const w = document.querySelector('.ca-arch-proj-wrap');
            return w ? w.textContent.replace(/\s+/g, ' ').trim() : '';
        });
        ok(rosterPanel.indexOf('Remaining flights') !== -1 && rosterPanel.indexOf('2 flights completed \u00b7 2 left') !== -1, 'v1.45.18: the panel counts history vs the schedule (2 landed entries, 2 roster legs): ' + rosterPanel);
        ok(rosterPanel.indexOf('$') === -1, 'roster-only legs carry no dollar figure at all');
        // the centred ✕: its visual centre lines up with the text block
        const xAlign = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('#ca-arch-list .ca-arch-row')];
            if (!rows.length) return { none: true };
            const ds = rows.map((r) => {
                const del = r.querySelector('.ca-arch-del').getBoundingClientRect();
                const main = r.querySelector('.ca-arch-rowmain').getBoundingClientRect();
                const amt = r.querySelector('.ca-arch-amt').getBoundingClientRect();
                return { delC: del.top + del.height / 2, mainC: main.top + main.height / 2, mainBot: main.bottom, amtBot: amt.bottom, delFlex: getComputedStyle(r.querySelector('.ca-arch-del')).display };
            });
            return { none: false, n: rows.length, sag: Math.max(...ds.map((d) => Math.abs(d.delC - d.mainC))), base: Math.max(...ds.map((d) => Math.abs(d.mainBot - d.amtBot))), flex: ds.every((d) => d.delFlex === 'flex') };
        });
        ok(!xAlign.none && xAlign.sag <= 2, 'v1.45.15: the ✕ centres on the text block - the sag is gone (max ' + (xAlign.sag || 0).toFixed(1) + 'px over ' + (xAlign.n || 0) + ' rows)');
        ok(xAlign.base <= 1.5, 'the route block and the value share one baseline (max ' + (xAlign.base || 0).toFixed(1) + 'px)');
        ok(xAlign.flex, 'the ✕ rides its flex items-center justify-center wrapper');
        // the heavier inactive inks (dark first)
        const inkDark = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            const cs = getComputedStyle(seg);
            return { color: cs.color, weight: cs.fontWeight };
        });
        eq(inkDark.color, 'rgb(26, 19, 0)', 'v1.45.15: espresso solid #1A1300 inactive ink by night');
        eq(inkDark.weight, '800', 'the inactive pills carry font-weight 800');
        await page.evaluate(() => { document.documentElement.classList.remove('dark'); });
        await sleep(300);
        const inkLight = await page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            return { color: getComputedStyle(seg).color, weight: getComputedStyle(seg).fontWeight };
        });
        eq(inkLight.color, 'rgb(45, 30, 15)', 'v1.45.15: strict walnut #2D1E0F inactive ink by day');
        eq(inkLight.weight, '800', 'the weight holds in daylight');
        const walnutAA2 = await page.evaluate(() => {
            const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
            const comp = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            const ratio = (a, b) => { const l1 = Math.max(lum(a), lum(b)), l2 = Math.min(lum(a), lum(b)); return (l1 + 0.05) / (l2 + 0.05); };
            const stops = [...getComputedStyle(document.getElementById('ca-arch-summary')).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]));
            const wash = parse(getComputedStyle(document.querySelector('.ca-arch-segtrack')).backgroundColor);
            const pillBg = comp(wash, stops[0]);
            const seg = document.querySelector('#ca-arch-summary .ca-arch-seg:not(.ca-arch-segon)');
            return ratio(comp(parse(getComputedStyle(seg).color), pillBg), pillBg);
        });
        ok(walnutAA2 >= 4.5, 'the walnut ink reads at AA over the gold by day (got ' + walnutAA2.toFixed(2) + ':1)');
        await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.upcoming'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.16: the state icons ride the title, the words ride the count line —');
        // history + a live current month + a pre-saved future month: every
        // state in one view
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const past = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            const flown = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 5, 1));
            const ahead = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const nxt = new Date(now.getFullYear(), now.getMonth() + 1, 15);
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' }));
            // the live month's ahead flight with Math.min(date+5, 27), which
            // on the 27th evening was TODAY - and past midnight it read as
            // flown, the live month flipped to Completed, and the refresh-cw
            // probe crashed the run on a null. endAt in the future is the
            // run-hour-immune wall: archEntryLanded honours it over dates, so
            // the ahead and next-month entries stay unflown at any hour of
            // any day the rig runs.
            const aheadEnt = ent('i2', ahead, 70); aheadEnt.endAt = Date.now() + 6 * 3600 * 1000;
            const nxtEnt = ent('i3', nxt, 60); nxtEnt.endAt = Date.now() + 30 * 24 * 3600 * 1000;
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('i0', past, 90), ent('i1', flown, 80), aheadEnt, nxtEnt]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        const state16 = await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const cur = ym(now), prev = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), nxt = ym(new Date(now.getFullYear(), now.getMonth() + 1, 1));
            const head = (mk) => document.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]');
            const sub = (mk) => head(mk).querySelector('.block.text-sm').textContent.replace(/\s+/g, ' ').trim();
            const title = (mk) => head(mk).querySelector('.text-\\[17px\\]');
            const stateIco = (mk) => head(mk).querySelector('i[data-lucide="refresh-cw"], i[data-lucide="clock-arrow-up"]');
            return {
                cur, prev, nxt,
                pastSub: sub(prev), pastIco: !!stateIco(prev),
                curSub: sub(cur), curNext: title(cur).nextElementSibling ? title(cur).nextElementSibling.getAttribute('data-lucide') : null,
                nxtSub: sub(nxt), nxtNext: title(nxt).nextElementSibling ? title(nxt).nextElementSibling.getAttribute('data-lucide') : null
            };
        });
        ok(state16.pastSub.indexOf('\u2022') === -1 && !state16.pastIco, 'v1.45.16: a past month carries no state asset and no status suffix (got ' + JSON.stringify(state16.pastSub) + ')');
        ok(state16.curSub.indexOf('\u2022 In progress') !== -1 && state16.curNext === 'refresh-cw', 'the live month counts then names its state, refresh-cw beside the title (' + state16.curSub + ')');
        ok(state16.nxtSub.indexOf('\u2022 Upcoming') !== -1 && state16.nxtNext === 'clock-arrow-up', 'the future month rides the owner format with clock-arrow-up (' + state16.nxtSub + ')');
        // v1.48.2 (owner order): the live month's icon KEEPS TURNING behind
        // the ca-reduced gate — the departure-board roll's fellow exception.
        // A control probe proves the gate itself is live (its loop stops)
        // while the refresh-cw holds its animationName.
        const reducedSpin = await page.evaluate(() => {
            const h = document.documentElement;
            const ico = document.querySelector('.ca-arch-group-head i[data-lucide="refresh-cw"]');
            const ctl = document.createElement('div'); ctl.className = 'animate-pulse'; document.body.appendChild(ctl);
            h.classList.add('ca-reduced');
            const name = getComputedStyle(ico).animationName;
            const ctlName = getComputedStyle(ctl).animationName;
            h.classList.remove('ca-reduced');
            ctl.remove();
            return { live: name, ctl: ctlName, back: getComputedStyle(ico).animationName };
        });
        eq(reducedSpin.ctl, 'none', 'the control loop stops behind the ca-reduced gate (the gate is live)');
        eq(reducedSpin.live, 'caArchLive', 'v1.48.2 (owner order): the live month\u2019s icon keeps turning behind the ca-reduced gate');
        eq(reducedSpin.back, 'caArchLive', 'and it is the same ambient loop when the gate lifts');
        // an all-flown current month reads Completed, icon-free
        const doneWord = await page.evaluate(() => {
            const keep = localStorage.getItem('crewAssist.archive');
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const past = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('j0', past, 90), ent('j1', new Date(now.getFullYear(), now.getMonth(), 2), 80)]));
            closeArchOverlay();
            showArchiveOverlay();
            const cur = ym(now);
            const head = document.querySelector('.ca-arch-group-head[data-mk="' + cur + '"]');
            const sub = head ? head.querySelector('.block.text-sm').textContent.replace(/\s+/g, ' ').trim() : '';
            const ico = head ? head.querySelector('i[data-lucide="refresh-cw"], i[data-lucide="clock-arrow-up"]') : null;
            localStorage.setItem('crewAssist.archive', keep);
            return { sub, ico: !!ico };
        });
        ok(doneWord.sub.indexOf('\u2022 Completed') !== -1 && !doneWord.ico, 'an all-flown current month reads Completed in the count line, icon-free (' + doneWord.sub + ')');
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.17: the milestone line + the daylight placeholder —');
        // a landed entry + a saved future one: the milestone branch fires
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const past = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 5, 1));
            const ahead = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' }));
            const k1e = ent('k1', ahead, 696.91); k1e.endAt = Date.now() + 6 * 3600 * 1000;   // midnight wall: Remaining to earn, never Month complete
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('k0', past, 300), k1e]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        // v1.45.59 (owner report) + v1.48.0: the open roll waits out the
        // glide (~360ms) — read at ~460ms, mid-roll on the Remaining-to-earn
        // line: the digits ride ONE wrapper run beside the mounted icon; the
        // flex cell can never gap its characters, and the icon never leaves
        await sleep(460);
        ok(await page.evaluate(() => {
            const ctx = document.getElementById('ca-arch-m-ctx');
            const cells = ctx.querySelectorAll('.ca-rollc');
            const wraps = ctx.querySelectorAll('.ca-rollwrap');
            const icon = ctx.querySelector('i[data-lucide=\"target\"]');
            return cells.length > 0 && wraps.length >= 1 && !!icon
                && Array.from(ctx.children).every((c) => String(c.className).indexOf('ca-rollc') < 0);
        }), 'v1.45.59 (owner report): the milestone line rolls its digits inside ONE wrapper — the icon stays mounted, no cell is a direct flex child (no mid-roll spacing)');
        // v1.45.57 hotfix: the ctx cell rolls on the open — the icon/shape
        // read waits out the settle; the text reads ride the truth
        await sleep(1000);
        const milestone17 = await page.evaluate(() => {
            const label = document.getElementById('ca-arch-m-ctx-label');
            const ctx = document.getElementById('ca-arch-m-ctx');
            const cs = label ? getComputedStyle(label) : null;
            return {
                label: label ? label.textContent : '',
                upper: cs ? cs.textTransform : '', track: cs ? cs.letterSpacing : '', size: cs ? cs.fontSize : '',
                html: ctx ? ctx.innerHTML : '', text: ctx ? ctx.textContent.trim() : '',
                cls: ctx ? ctx.className : '',

            };
        });
        eq(milestone17.label, 'Remaining to earn', 'v1.45.17: the milestone label reads Remaining to earn');
        eq(milestone17.upper, 'uppercase', 'the label keeps its uppercase transform');
        ok(milestone17.track !== '0px' && milestone17.size === '11px', 'the label keeps its tracking and the 11px MICRO rung (letter-spacing ' + milestone17.track + ')');
        ok(milestone17.html.indexOf('data-lucide="target"') !== -1 && milestone17.html.indexOf('w-3.5 h-3.5 shrink-0') !== -1, 'the bullseye icon and its size survive');
        ok(milestone17.text.indexOf('$696.91 before end of month') !== -1, 'the owner format verbatim: ' + milestone17.text);
        ok(milestone17.cls.indexOf('flex items-center gap-2') !== -1, 'the inline centre baseline with the icon stays');
        // the daylight placeholder ink (dark first: the UA default holds)
        const phDark = await page.evaluate(() => getComputedStyle(document.getElementById('ca-arch-search'), '::placeholder').color);
        await page.evaluate(() => { document.documentElement.classList.remove('dark'); });
        await sleep(300);
        const phLight = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('ca-arch-search'), '::placeholder'); return { color: cs.color, opacity: cs.opacity }; });
        eq(phLight.color, 'rgb(107, 114, 128)', 'v1.45.17: the daylight placeholder computes dark slate #6B7280');
        eq(phLight.opacity, '1', 'the tone is pinned at full opacity across engines');
        ok(phDark !== 'rgb(107, 114, 128)', 'the night placeholder keeps its own (default) ink, untouched by the daylight rule');
        await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.18: the remaining-flights panel + the all-time annual average —');
        // saved case: two landed entries, one priced future duty
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const p1 = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 9, 1));
            const p2 = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 5, 1));
            const ahead = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' }));
            const r2w = ent('r2', ahead, 696.91); r2w.endAt = Date.now() + 6 * 3600 * 1000;   // midnight wall: the panel's still-to-fly leg stays ahead
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('r0', p1, 150), ent('r1', p2, 150), r2w]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-proj-btn').click());
        await sleep(300);
        const panel18 = await page.evaluate(() => {
            const w = document.querySelector('.ca-arch-proj-wrap');
            const micro = w.querySelector('.ca-micro');
            const gold = w.querySelector('.text-\\[17px\\]');
            return { text: w.textContent.replace(/\s+/g, ' ').trim(), header: micro ? micro.textContent : '', headerUpper: micro ? getComputedStyle(micro).textTransform : '', gold: gold ? gold.textContent : '', goldRight: gold ? getComputedStyle(gold.parentElement).justifyContent : '' };
        });
        eq(panel18.header, 'Remaining flights', 'v1.45.18: the panel header reads Remaining flights');
        eq(panel18.headerUpper, 'uppercase', 'the header keeps its uppercase micro style');
        ok(panel18.text.indexOf('2 flights completed \u00b7 1 left') !== -1, 'the line counts completed vs left (owner format): ' + panel18.text);
        eq(panel18.gold, '$696.91', 'the right-aligned gold figure is preserved exactly');
        eq(panel18.goldRight, 'space-between', 'the header row keeps its flex justify-between layout');
        // the all-time annual average: 2025 $1,000 + 2026 $500 -> $750.00
        await page.evaluate(() => {
            const now = new Date();
            const ent = (id, mk, d, amount) => ({ id, savedAt: d + 'T10:00:00Z', monthKey: mk, sectorDate: d, stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.archive', JSON.stringify([
                ent('y0', '2025-06', '2025-06-05', 600),
                ent('y1', '2025-07', '2025-07-05', 400),
                ent('y2', String(now.getFullYear()) + '-03', String(now.getFullYear()) + '-03-05', 500)
            ]));
            closeArchOverlay();
            showArchiveOverlay();
        });
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        // v1.45.57 hotfix: the whole card rolled on the scope change — the
        // spans/html shape read waits out the settle
        await sleep(1000);
        const avg18 = await page.evaluate(() => {
            const label = document.getElementById('ca-arch-m-ctx-label');
            const ctx = document.getElementById('ca-arch-m-ctx');
            const avgCell = document.getElementById('ca-arch-m-avg');
            const lcs = getComputedStyle(label), vcs = getComputedStyle(ctx), acs = getComputedStyle(avgCell);
            return {
                label: label.textContent, upper: lcs.textTransform, size: lcs.fontSize, track: lcs.letterSpacing,
                val: ctx.textContent, spans: ctx.querySelectorAll('span').length, html: ctx.innerHTML,
                vSize: vcs.fontSize, vWeight: vcs.fontWeight, vNowrap: vcs.whiteSpace, aSize: acs.fontSize, aWeight: acs.fontWeight
            };
        });
        eq(avg18.label, 'Annual avg', 'v1.45.18: COP + ALL-TIME carries the ANNUAL AVG column (Context unmounted)');
        eq(avg18.upper, 'uppercase', 'the new header keeps the small muted uppercase label style');
        ok(avg18.size === '11px' && avg18.track !== '0px', 'the label rides the 11px MICRO rung with tracking (letter-spacing ' + avg18.track + ')');
        eq(avg18.val, '$750.00', 'the annual average = career COP over the years on record');
        eq(avg18.spans, 0, 'the value rides bare text - the ctx ellipsis rule can never clip it');
        ok(avg18.html.indexOf('vs LY') === -1 && avg18.html.indexOf('proj.') === -1, 'the truncating context parts are gone');
        ok(avg18.vSize === avg18.aSize && avg18.vWeight === avg18.aWeight && avg18.vNowrap === 'nowrap', 'the value matches the FLIGHTS / AVG-per-flight typography (14px/700/nowrap) and can never wrap out');
        // YEAR scope keeps its YTD context
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="year"]').click());
        await sleep(300);
        const year18 = await page.evaluate(() => document.getElementById('ca-arch-m-ctx-label').textContent);
        ok(/YTD$/.test(year18), 'the YEAR scope keeps its YTD context (only ALL-TIME carries Annual avg): ' + year18);
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.20: the hairline quadrants + the breathing month row —');
        // a salary profile + a month with data + one entry last year (the
        // YEAR row-2 comparison needs a last-year record); the rig viewport
        // (390px) proves the layout, then a wide viewport proves the quadrants
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const past = new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 9, 1));
            const ahead = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const ent = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] } });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS', basicSalary: 2600 }));
            localStorage.setItem('crewAssist.archive', JSON.stringify([ent('g0', past, 300), ent('g1', ahead, 396.91), ent('gly', new Date(now.getFullYear() - 1, now.getMonth(), 10), 150)]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.mouse.move(2, 2);
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        // v1.45.56: the gross line just ROLLED — shape reads (children,
        // styles) wait out the ~840ms restore; text reads above read the
        // truth mid-roll
        await sleep(1000);
        const gross20 = await page.evaluate(() => {
            const gl = document.getElementById('ca-arch-gross-line');
            const cs = getComputedStyle(gl);
            const row1 = gl.children[0];
            return { text: gl.textContent.trim(), kids: gl.children.length, row1: row1 ? row1.textContent : '', display: cs.display, nowrap: row1 ? (row1.getAttribute('style') || '') : '', right: gl.children[1] ? gl.children[1].textContent : '', pipe: !!gl.querySelector('.ca-arch-gross-sep'), pipeOp: gl.querySelector('.ca-arch-gross-sep') ? getComputedStyle(gl.querySelector('.ca-arch-gross-sep')).opacity : '' };
        });
        ok(gross20.display === 'block' && gross20.kids === 1 && gross20.row1.indexOf('Gross ') === 0 && gross20.row1.indexOf('CPF ') !== -1, 'v1.45.21: the subtext is the single never-wrapping row, in every scope: ' + gross20.row1);
        ok(gross20.nowrap.indexOf('nowrap') !== -1, 'the figures carry the strict no-wrap security');
        ok(!gross20.right && gross20.text.indexOf('On track for') === -1 && gross20.text.indexOf('vs ') === -1, 'the right side is completely empty - the on-track milestone and the month comparison are deleted (breathing room)');
        ok(gross20.pipe && gross20.pipeOp === '0.45', 'the muted pipe separates Gross from CPF (opacity ' + gross20.pipeOp + ')');
        // the quadrant labels + icons at the rig viewport
        const icons20 = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-salary');
            const labels = [...el.querySelectorAll('.ca-arch-metalabel')].map((l) => l.textContent.trim());
            const icos = [...el.querySelectorAll('.ca-arch-metalabel i')].map((i) => ({ n: i.getAttribute('data-lucide'), w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height, c: getComputedStyle(i).color }));
            const pair = el.querySelector('.ca-arch-metipair');
            return { labels, icos, pairGap: pair ? getComputedStyle(pair).gap : '' };
        });
        ok(icons20.labels.join('|') === 'Basic|Fixed|After-hours|COP', 'v1.45.20: MIDNIGHTS is renamed AFTER-HOURS (the small muted uppercasing rides the label CSS)');
        ok(icons20.icos.map((i) => i.n).join(',') === 'circle-dollar-sign,shirt,car-front,car-taxi-front,plane', 'the icon map: Basic circle-dollar-sign, Fixed shirt+car-front, After-hours car-taxi-front, COP plane');
        ok(icons20.icos.every((i) => Math.abs(i.w - 14) <= 0.5 && Math.abs(i.h - 14) <= 0.5), 'every icon renders at the uniform 14px (w-3.5 h-3.5)');
        ok(icons20.icos.every((i) => i.c === 'rgba(26, 19, 0, 0.55)') && icons20.pairGap === '2px', 'the icons ride the low-opacity espresso token and the Fixed pair sits tight (' + icons20.icos[0].c + ', gap ' + icons20.pairGap + ')');
        // the YEAR view: the comparison rides beside the figure as the badge
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="year"]').click());
        await sleep(300);
        const year21 = await page.evaluate(() => {
            const b = document.getElementById('ca-arch-netyoy');
            const cs = getComputedStyle(b);
            const num = document.getElementById('ca-arch-total');
            const ico = b.querySelector('i[data-lucide]');
            return { hidden: b.classList.contains('hidden'), txt: b.textContent, cls: b.className, ml: cs.marginLeft, fs: cs.fontSize, fw: cs.fontWeight, wrap: cs.whiteSpace, color: cs.color, sameRow: b.parentElement === num.parentElement, align: getComputedStyle(b.parentElement).alignItems, gap: b.getBoundingClientRect().left - num.getBoundingClientRect().right, glKids: document.getElementById('ca-arch-gross-line').children.length,
                ico: ico ? ico.getAttribute('data-lucide') : '', icoCls: ico ? ico.className : '', icoW: ico ? ico.getBoundingClientRect().width : 0, disp: cs.display, igap: cs.gap, ialign: cs.alignItems, spanTxt: b.querySelector('span') ? b.querySelector('span').textContent : '', tri: b.textContent.indexOf('\u25b2') !== -1 || b.textContent.indexOf('\u25bc') !== -1 };
        });
        ok(!year21.hidden && /^trending-(up|down)$/.test(year21.ico) && /^[+\u2212]\d+\.\d%$/.test(year21.spanTxt) && !year21.tri, 'v1.45.22: the YEAR badge wears the trending icon with the signed percentage - triangles retired (' + year21.ico + ' ' + year21.spanTxt + ')');
        ok(year21.icoCls.indexOf('w-3.5') !== -1 && year21.icoCls.indexOf('h-3.5') !== -1 && Math.abs(year21.icoW - 14) <= 0.5, 'the badge icon rides the 14px box (w-3.5 h-3.5, measured ' + year21.icoW.toFixed(1) + 'px)');
        ok((year21.disp === 'inline-flex' || year21.disp === 'flex') && year21.ialign === 'center' && year21.igap === '4px', 'the badge is a flex pair - icon and figure centred, 4px apart (inline-flex blockifies inside the baseline row: ' + year21.disp + ')');
        ok(year21.sameRow && year21.align === 'baseline' && year21.ml === '12px' && year21.gap >= 11, 'the badge shares the figure row on the strict text baseline, 12px off the number');
        ok(year21.fs === '14px' && year21.fw === '700' && year21.wrap === 'nowrap', 'the badge rides the 14px value rung, bold, never wrapping');
        ok(year21.color === 'rgb(18, 63, 34)' || year21.color === 'rgb(110, 31, 31)', 'deep green for growth, deep brick for decline (' + year21.color + ')');
        ok(year21.glKids === 1, 'the gross row stays the single string - no second row anywhere');
        // the badge ink passes AA over the gold card's mid stop (its zone of the gradient)
        const badgeAA = await page.evaluate(() => {
            const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
            const fg = parse(getComputedStyle(document.getElementById('ca-arch-netyoy')).color);
            const stops = [...getComputedStyle(document.getElementById('ca-arch-summary')).backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]));
            const mid = stops[1];
            return { ratio: (Math.max(lum(fg), lum(mid)) + 0.05) / (Math.min(lum(fg), lum(mid)) + 0.05) };
        });
        ok(badgeAA.ratio >= 4.5, 'the badge ink passes AA over the gold mid stop (ratio ' + badgeAA.ratio.toFixed(2) + ')');
        // the earliest year hides the badge entirely
        await page.evaluate(() => document.getElementById('ca-arch-seg-year').click());
        await sleep(300);
        const early21 = await page.evaluate(() => ({ hidden: document.getElementById('ca-arch-netyoy').classList.contains('hidden'), yr: document.getElementById('ca-arch-seg-year').textContent }));
        ok(early21.hidden, 'the earliest year hides the badge entirely - no prior year to cite (' + early21.yr + ')');
        // the earliest COP year reads the clean quiet em dash
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="cop"]').click());
        await sleep(300);
        const dash21 = await page.evaluate(() => ({ txt: document.getElementById('ca-arch-m-ctx').textContent, label: document.getElementById('ca-arch-m-ctx-label').textContent }));
        ok(dash21.txt === '\u2014', 'v1.45.21: the earliest COP year reads the clean quiet em dash (' + JSON.stringify(dash21.txt) + ')');
        ok(dash21.label.indexOf('not on record') === -1 && dash21.txt.indexOf('not on record') === -1, 'no text placeholder remains');
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        await sleep(300);
        // ALL-TIME keeps the single row and hides the badge
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(1000);
        const all20 = await page.evaluate(() => ({ kids: document.getElementById('ca-arch-gross-line').children.length, badgeHidden: document.getElementById('ca-arch-netyoy').classList.contains('hidden') }));
        ok(all20.kids === 1 && all20.badgeHidden, 'the ALL-TIME view keeps the single row and hides the badge - the comparison is a YEAR-only privilege');
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="month"]').click());
        await sleep(300);
        // the strict 2x2 at a wide viewport
        await page.setViewport({ width: 800, height: 844, hasTouch: true });
        await sleep(400);
        const quad20 = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-salary');
            const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat);
            const kids = [...el.children];
            const widths = kids.map((c) => c.getBoundingClientRect().width);
            const heights = kids.map((c) => c.getBoundingClientRect().height);
            const gs = kids.map((c) => { const g = getComputedStyle(c); return { pr: g.paddingRight, brw: g.borderRightWidth, bbw: g.borderBottomWidth }; });
            const clips = kids.map((c) => c.scrollWidth > c.clientWidth + 1);
            return { tracks, widths, heights, gs, clips, xr: widths[0] / widths[1], yr: heights[0] / heights[2] };
        });
        ok(quad20.tracks.length === 2 && Math.abs(quad20.tracks[0] - quad20.tracks[1]) <= 1, 'v1.45.20: at 800px the salary row still rides the strict 2x2 - the hairlines own the tracks, no fold');
        ok(Math.abs(quad20.xr - 1) <= 0.02 && Math.abs(quad20.yr - 1) <= 0.1, 'equal halves, equal rows - the quadrant aggregate of the old 3/2/3/4 weights (ratios ' + quad20.xr.toFixed(2) + '/' + quad20.yr.toFixed(2) + ')');
        ok(quad20.gs.every((g) => g.pr === '12px'), 'every quadrant pads a uniform 12px off the hairlines');
        ok(quad20.gs[0].brw === '1px' && quad20.gs[2].brw === '1px' && quad20.gs[1].brw === '0px' && quad20.gs[3].brw === '0px', 'the vertical centre axis: Basic + After-hours carry the right hairline');
        ok(quad20.gs[0].bbw === '1px' && quad20.gs[1].bbw === '1px' && quad20.gs[2].bbw === '0px' && quad20.gs[3].bbw === '0px', 'the horizontal centre axis: Basic + Fixed carry the bottom hairline');
        ok(!quad20.clips.some(Boolean), 'nothing clips on the quadrants - seven-digit aggregates keep layout freedom');
        const hair20 = await page.evaluate(() => {
            const h = document.documentElement;
            const wasDark = h.classList.contains('dark');
            const el = document.getElementById('ca-arch-meta-salary').children[0];
            const cop = document.getElementById('ca-arch-meta-cop').children[0];
            h.classList.add('dark'); void el.offsetWidth;
            const dk = getComputedStyle(el).borderRightColor;
            const copDk = getComputedStyle(cop).borderRightColor;
            h.classList.remove('dark'); void el.offsetWidth;
            const lt = getComputedStyle(el).borderRightColor;
            const copLt = getComputedStyle(cop).borderRightColor;
            if (wasDark) h.classList.add('dark');
            return { dk, lt, copDk, copLt };
        });
        ok(hair20.dk === 'rgba(255, 255, 255, 0.08)' && hair20.lt === 'rgba(0, 0, 0, 0.06)', 'the salary hairlines ride the theme tokens (night ' + hair20.dk + ' / day ' + hair20.lt + ')');
        ok(hair20.copDk === 'rgba(255, 255, 255, 0.08)' && hair20.copLt === 'rgba(0, 0, 0, 0.06)', 'v1.45.21: the COP hairlines ride the same theme tokens (night ' + hair20.copDk + ' / day ' + hair20.copLt + ')');
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(400);
        // under 360px the values scale down 1.5px
        await page.setViewport({ width: 340, height: 844, hasTouch: true });
        await sleep(400);
        const tiny20 = await page.evaluate(() => {
            const el = document.getElementById('ca-arch-meta-salary');
            const vals = [...el.querySelectorAll('.ca-arch-metaval')].map((v) => v.scrollWidth > v.clientWidth + 1);
            const size = getComputedStyle(document.getElementById('ca-arch-m-cop')).fontSize;
            return { size, clips: vals.some(Boolean), tracks: getComputedStyle(el).gridTemplateColumns.split(' ').length };
        });
        eq(tiny20.size, '12.5px', 'the under-360px value step survives the rebuild (14 -> 12.5px)');
        ok(tiny20.tracks === 2 && !tiny20.clips, 'the 2x2 quadrant grid holds under 360px and nothing breaks');
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.22: overseas expenses + the three-row money column —');
        // The expense feature in the real browser: a layover carries an SGD
        // lump sum; the salary card gains the Exp segment + the quiet after
        // line, the month head gains its third quiet row, and the summary
        // sheet's receipt row edits the stored figure end to end.
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const cur = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 5, 27));
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            const det = (amount, exp) => { const d = { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, rankRate: 22.5, sectors: [{ fn: '603', dep: 'SIN', arr: 'ICN', depYmd: '2026-10-05', ftHm: '6H 20M', mult: 1, amount: 50, paxing: false }], stations: [{ code: 'SIN' }, { code: 'ICN' }] }; if (exp) d.expense = exp; return d; };
            const lay = (id, d, amount, exp) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/ICN', amount, flightType: 'Layover', detail: det(amount, exp) });
            const tur = (id, d, amount) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/KUL', amount, flightType: 'Turnaround', detail: det(amount, 0) });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS', basicSalary: 2600 }));
            localStorage.setItem('crewAssist.archive', JSON.stringify([lay('x1', cur, 400, 120), lay('x2', prev, 300), tur('x3', cur, 90)]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode=\"salary\"]').click());
        await sleep(400);
        // v1.48.3 (owner order): dev mode off - the expense DISPLAY renders on
        // every device (the v1.45.31 display gate is superseded; only the
        // keying editor stays dev's). The Exp figure sits on its OWN row -
        // the iPhone 11 clip fix, proven in computed geometry.
        const gate31 = await page.evaluate(() => {
            const gl = document.getElementById('ca-arch-gross-line');
            const el = document.getElementById('ca-arch-exp-line');
            const al = document.getElementById('ca-arch-after-line');
            const amt = document.querySelector('.ca-arch-group-head').closest('.ca-arch-group').querySelector('.ca-arch-amt');
            return { expTxt: el.textContent, expHidden: el.classList.contains('hidden'), afterHidden: al.classList.contains('hidden'), cells: amt ? amt.children.length : 0, hasAfter: !!(amt && amt.querySelector('.ca-arch-amt-after')), ownRow: el.getBoundingClientRect().top >= gl.getBoundingClientRect().bottom - 1 };
        });
        ok(gate31.expTxt === 'Exp \u2212$120.00' && !gate31.expHidden && !gate31.afterHidden, 'v1.48.3 (owner order): dev mode off - the salary card still SHOWS the expense: the Exp line and the after line render on every device');
        ok(gate31.ownRow, 'v1.48.3 (owner order): the Exp figure sits ON ITS OWN ROW below the Gross|CPF line - computed geometry, the narrow-phone clip is gone');
        ok(gate31.cells === 6 && gate31.hasAfter, 'v1.48.3: the month head keeps its N-minus row with dev mode off');
        ok(await page.evaluate(() => { openArchEntry('x1'); const ro = document.querySelector('[data-ca-arch-exp-row]'); return !!ro && ro.textContent.indexOf('$120.00') !== -1 && !document.getElementById('ca-arch-exp-btn'); }), 'v1.48.3: dev mode off - the layover summary shows the expense as a READ-ONLY statement, no editor button outside dev mode');
        await page.evaluate(() => { closeArchSub(); closeArchOverlay(); });
        await sleep(300);
        await page.evaluate(() => { for (let i = 0; i < 10; i++) document.getElementById('header-brand').click(); });
        await sleep(300);
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.devMode') === 'true' && !document.getElementById('settings-developer').classList.contains('hidden') && document.getElementById('ca-arch-toast').textContent.indexOf('Developer Mode Enabled') !== -1), 'v1.45.31: ten taps on the brand unlock Developer Mode - the pane appears and the toast confirms');
        await page.evaluate(() => { showArchiveOverlay(); document.querySelector('.ca-arch-seg[data-mode=\"salary\"]').click(); });
        await sleep(400);
        const exp22 = await page.evaluate(() => {
            const mk = document.querySelector('.ca-arch-group-head').getAttribute('data-mk');
            const sal = archSalaryMonth(mk, loadArchive().filter((e) => e.monthKey === mk));
            const fm = (v) => formatMoney(v);
            const gl = document.getElementById('ca-arch-gross-line');
            const el = document.getElementById('ca-arch-exp-line');
            const al = document.getElementById('ca-arch-after-line');
            const head = document.querySelector('.ca-arch-group-head').closest('.ca-arch-group').querySelector('.ca-arch-amt');
            const netV = head.querySelector('.ca-arch-amt-net'), grossV = head.querySelector('.ca-arch-amt-gross'), afterV = head.querySelector('.ca-arch-amt-after');
            return { mk, expSeg: el.textContent === 'Exp \u2212$120.00', grossClean: gl.textContent.indexOf('Exp') === -1, afterHidden: al.classList.contains('hidden'), afterTxt: al.textContent, afterWant: 'After expenses ' + fm(sal.net - 120),
                rows: head.children.length, afterVal: afterV ? afterV.textContent : '', afterWantVal: fm(sal.net - 120),
                edgeN: netV.getBoundingClientRect().right, edgeG: grossV.getBoundingClientRect().right, edgeA: afterV ? afterV.getBoundingClientRect().right : 0,
                rowLbl: afterV ? afterV.previousElementSibling.textContent : '', rowMuted: afterV ? getComputedStyle(afterV).color === getComputedStyle(grossV).color && getComputedStyle(afterV.previousElementSibling).color === getComputedStyle(grossV.previousElementSibling).color : false };
        });
        ok(exp22.expSeg && exp22.grossClean, 'v1.48.3: the Exp figure reads on its OWN line under a clean Gross|CPF string (the dev-on view matches the dev-off one)');
        ok(!exp22.afterHidden && exp22.afterTxt === exp22.afterWant, 'the quiet after-expenses line reads net minus the month\u2019s expenses (' + exp22.afterTxt + ')');
        ok(exp22.rows === 6 && exp22.afterVal === exp22.afterWantVal && exp22.rowLbl === 'N\u2212', 'the month head grows the third row - six grid cells, the N-minus token leading its figure');
        ok(Math.abs(exp22.edgeN - exp22.edgeG) <= 1.5 && Math.abs(exp22.edgeN - exp22.edgeA) <= 1.5, 'all three figures right-align to the same edge - the decimals track one vertical line');
        ok(exp22.rowMuted, 'the third row rides the same muted ink as the gross row');
        // the no-expense month keeps two rows (all-time shows both months)
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(400);
        const head22b = await page.evaluate(() => {
            const heads = [...document.querySelectorAll('.ca-arch-group-head')];
            const h = heads.find((x) => x.closest('.ca-arch-group').querySelector('.ca-arch-amt-after') === null);
            if (!h) return { none: true };
            const amt = h.closest('.ca-arch-group').querySelector('.ca-arch-amt');
            return { none: false, rows: amt.children.length };
        });
        ok(!head22b.none && head22b.rows === 4, 'a month without expenses keeps exactly two grid rows (four cells) - the AFTER EXPENSES row unmounts entirely');
        // the sheet flow: receipt row -> edit -> commit -> live card -> undo -> zero removes
        await page.evaluate(() => document.querySelector('.ca-arch-group-head').click());
        await sleep(200);
        await page.evaluate(() => document.querySelector('.ca-arch-row[data-id=\"x1\"]').click());
        await sleep(400);
        ok(await page.evaluate(() => { const b = document.getElementById('ca-arch-exp-btn'); return b && b.textContent.indexOf('Overseas Expenses') !== -1 && document.getElementById('ca-arch-exp-val').textContent === '$120.00'; }), 'the layover summary carries the receipt row with the stored figure');
        ok(await page.evaluate(() => { const body = document.getElementById('ca-arch-sub-body'); const row = document.getElementById('ca-arch-exp-btn').parentElement; return body.children[0].textContent.indexOf('Grand Total') !== -1 && body.children[1] === row && body.children[2].textContent.indexOf('Flight Overview') !== -1; }), 'v1.45.31: the receipt row rides between the grand total card and the Flight Overview - above the iOS keyboard\u2019s reach (the owner\u2019s workaround)');
        await page.evaluate(() => document.getElementById('ca-arch-exp-btn').click());
        await sleep(200);
        await page.evaluate(() => { const i = document.querySelector('#ca-arch-exp-val input'); i.focus(); i.select(); });
        await page.keyboard.type('88.5');
        await page.keyboard.press('Enter');
        await sleep(500);
        const edit22 = await page.evaluate(() => ({
            val: document.getElementById('ca-arch-exp-val').textContent,
            stored: JSON.parse(localStorage.getItem('crewAssist.archive')).find((e) => e.id === 'x1').detail.expense,
            seg: document.getElementById('ca-arch-exp-line').textContent.indexOf('Exp \u2212$88.50') !== -1,
            toast: document.getElementById('ca-arch-toast').textContent.indexOf('Expense saved') !== -1
        }));
        ok(edit22.stored === 88.5 && edit22.val === '$88.50', 'typing a new expense commits to the stored figure and paints the row');
        ok(edit22.seg && edit22.toast, 'the card behind the sheet and the toast pick the new figure up');
        await page.evaluate(() => document.getElementById('ca-arch-toast').querySelector('button').click());
        await sleep(400);
        const undo22 = await page.evaluate(() => ({
            stored: JSON.parse(localStorage.getItem('crewAssist.archive')).find((e) => e.id === 'x1').detail.expense,
            val: document.getElementById('ca-arch-exp-val').textContent
        }));
        ok(undo22.stored === 120 && undo22.val === '$120.00', 'undo restores the previous expense everywhere');
        await page.evaluate(() => document.getElementById('ca-arch-exp-btn').click());
        await sleep(200);
        await page.evaluate(() => { const i = document.querySelector('#ca-arch-exp-val input'); i.focus(); i.select(); });
        await page.keyboard.type('0');
        await page.keyboard.press('Enter');
        await sleep(500);
        const zero22 = await page.evaluate(() => ({
            has: 'expense' in JSON.parse(localStorage.getItem('crewAssist.archive')).find((e) => e.id === 'x1').detail,
            val: document.getElementById('ca-arch-exp-val').textContent,
            afterHidden: document.getElementById('ca-arch-after-line').classList.contains('hidden')
        }));
        ok(!zero22.has && zero22.val === 'Add Expenses' && zero22.afterHidden, 'a zero commit removes the expense - the affordance returns, the after line hides');
        // COP lens: expenses are a salary-lens privilege
        await page.evaluate(() => { closeArchSub(); document.querySelector('.ca-arch-seg[data-mode=\"cop\"]').click(); });
        await sleep(400);
        ok(await page.evaluate(() => document.getElementById('ca-arch-after-line').classList.contains('hidden') && document.getElementById('ca-arch-exp-line').classList.contains('hidden') && document.getElementById('ca-arch-gross-line').classList.contains('hidden')), 'the COP lens shows no expense context - all three salary lines step aside, the Exp line included');
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.24: the money grid at iPhone width —');
        // The order's headline contract, measured where it lives: nothing
        // wraps and nothing clashes at 375px. A three-row month (expenses
        // present) drops the grid to its own right-aligned line under the
        // month text; a two-row month keeps the side-by-side form; wide
        // screens keep the side-by-side form for both.
        await page.evaluate(() => {
            const now = new Date();
            const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const ymd = (d) => ym(d) + '-' + String(d.getDate()).padStart(2, '0');
            const cur = new Date(now.getFullYear(), now.getMonth(), 15);
            const det = (amount, exp) => { const d = { v: 1, type: 'both', ifaTotal: amount, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: amount, sectors: [], stations: [] }; if (exp) d.expense = exp; return d; };
            const lay = (id, d, amount, exp) => ({ id, savedAt: ymd(d) + 'T10:00:00Z', monthKey: ym(d), sectorDate: ymd(d), stationDisplay: 'SIN/ICN', amount, flightType: 'Layover', detail: det(amount, exp) });
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS', basicSalary: 2600 }));
            localStorage.setItem('crewAssist.archive', JSON.stringify([lay('g1', cur, 400, 120), lay('g2', cur, 350), lay('g3', cur, 380)]));
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode=\"salary\"]').click());
        await sleep(400);
        await page.setViewport({ width: 375, height: 812, hasTouch: true });
        await sleep(400);
        const grid375 = await page.evaluate(() => {
            const grp = document.querySelector('.ca-arch-group');
            const head = grp.querySelector('.ca-arch-group-head');
            const amt = grp.querySelector('.ca-arch-amt');
            const monthLbl = head.querySelector('span.text-\\[17px\\]');
            const countLine = head.querySelector('span.block');
            const hb = head.getBoundingClientRect(), ab = amt.getBoundingClientRect();
            const cells = [...amt.children];
            const net = amt.querySelector('.ca-arch-amt-net'), gross = amt.querySelector('.ca-arch-amt-gross'), after = amt.querySelector('.ca-arch-amt-after');
            const lblL = cells.filter((c) => c.classList.contains('ca-arch-mglbl')).map((c) => c.getBoundingClientRect().left);
            const valR = [net, gross, after].map((c) => c.getBoundingClientRect().right);
            return { cells: cells.length, stacked: ab.top > hb.bottom - 2,
                month1: monthLbl.getBoundingClientRect().height <= 22, count2: countLine.getBoundingClientRect().height <= 41,
                noClip: cells.every((c) => c.scrollWidth <= c.clientWidth + (c.classList.contains('ca-arch-mgtok') ? 5 : 1)),
                rail: Math.max(...lblL) - Math.min(...lblL) <= 1, edge: Math.max(...valR) - Math.min(...valR) <= 1.5,
                right: Math.abs(ab.right - (amt.closest('div.flex').getBoundingClientRect().right - 12)) <= 1,
                listOk: document.getElementById('ca-arch-list').scrollWidth <= document.getElementById('ca-arch-list').clientWidth + 1,
                netGold: getComputedStyle(net).color, netLblGold: getComputedStyle(cells[0]).color, secMut: getComputedStyle(gross).color };
        });
        ok(grid375.cells === 6 && !grid375.stacked, 'v1.45.24 at 375px: the token rail is narrow enough that the three-row grid SHARES the row with the month text again (six cells, no squeeze - the wrap guardrail stays dormant until a value runs long)');
        ok(grid375.month1 && grid375.count2, 'the month label stays one line; a long count line wraps cleanly at its word boundary inside its own box (two lines, never a collision - one line plus the block is 3px more than 375px can hold)');
        ok(grid375.noClip && grid375.listOk, 'no cell clips (the tokens\u2019 ::after hit extenders aside) and the list never scrolls sideways');
        ok(grid375.rail && grid375.edge && grid375.right, 'the label rail is one vertical line, the decimals track one right edge, the block hugs the row edge (12px inset)');
        ok(grid375.netGold === 'rgb(201, 162, 39)' && grid375.netLblGold === 'rgb(201, 162, 39)', 'the NET row wears the gold accent by night (label + figure: ' + grid375.netGold + ')');
        ok(grid375.secMut === 'rgba(255, 255, 255, 0.6)', 'the secondary rows ride the desaturated muted ink by night (' + grid375.secMut + ')');
        // the same grid by day: the gold ink token flips, the muted ink flips
        const gridDay = await page.evaluate(() => {
            const h = document.documentElement;
            h.classList.remove('dark'); void document.getElementById('ca-arch-list').offsetWidth;
            const net = document.querySelector('.ca-arch-group .ca-arch-amt-net');
            const gross = document.querySelector('.ca-arch-group .ca-arch-amt-gross');
            const out = { net: getComputedStyle(net).color, sec: getComputedStyle(gross).color };
            h.classList.add('dark'); void document.getElementById('ca-arch-list').offsetWidth;
            return out;
        });
        ok(gridDay.net === 'rgb(125, 101, 15)' && gridDay.sec === 'rgba(17, 24, 39, 0.62)', 'by day the NET gold ink reads #7d650f and the secondary rows the light muted token (' + gridDay.net + ' / ' + gridDay.sec + ')');
        // v1.45.24: the tokens decode on tap, in the real browser
        const tapN = await page.evaluate(() => {
            const tok = document.querySelector('.ca-arch-group .ca-arch-mgtok');
            tok.click();
            const tip = tok.querySelector('.ca-arch-mgtip');
            return { shown: !!tip, txt: tip ? tip.textContent : '', role: tip ? tip.getAttribute('role') : '', leftOf: tip ? tip.getBoundingClientRect().right <= tok.getBoundingClientRect().left : false, surface: tip ? getComputedStyle(tip).borderRadius : '' };
        });
        ok(tapN.shown && tapN.txt === 'Net Earnings' && tapN.role === 'tooltip' && tapN.leftOf, 'v1.45.24: tapping the N token decodes it - the micro-card bubble opens left of the token, on its own row (Net Earnings)');
        await sleep(2100);
        ok(await page.evaluate(() => !document.querySelector('.ca-arch-mgtip')), 'the bubble dismisses itself (the 1.8s auto-dismiss, fade included)');
        const tapOut = await page.evaluate(() => {
            const tok = document.querySelector('.ca-arch-group .ca-arch-mgtok');
            tok.click();
            return true;
        });
        await sleep(200);
        ok(await page.evaluate(() => !!document.querySelector('.ca-arch-mgtip')), 'the decode opens again after dismissal' + (tapOut ? '' : ''));
        await page.evaluate(() => document.body.click());
        await sleep(300);
        ok(await page.evaluate(() => !document.querySelector('.ca-arch-mgtip')), 'an outside tap dismisses the bubble');
        // a two-row month keeps the side-by-side form even at 375px
        const two375 = await page.evaluate(() => {
            const arr = JSON.parse(localStorage.getItem('crewAssist.archive'));
            arr.forEach((e) => { if (e.detail) delete e.detail.expense; });
            localStorage.setItem('crewAssist.archive', JSON.stringify(arr));
            renderArch();
            const grp = document.querySelector('.ca-arch-group');
            const head = grp.querySelector('.ca-arch-group-head');
            const amt = grp.querySelector('.ca-arch-amt');
            return { cells: amt.children.length, side: amt.getBoundingClientRect().top < head.getBoundingClientRect().bottom - 2, noClip: [...amt.children].every((c) => c.scrollWidth <= c.clientWidth + (c.classList.contains('ca-arch-mgtok') ? 5 : 1)) };
        });
        ok(two375.cells === 4 && two375.side && two375.noClip, 'the AFTER EXPENSES row unmounts entirely - four cells, and the tight grid shares the row again at 375px');
        // wide screens keep the side-by-side form for the three-row grid too
        await page.evaluate(() => {
            const arr = JSON.parse(localStorage.getItem('crewAssist.archive'));
            arr[0].detail.expense = 120;
            localStorage.setItem('crewAssist.archive', JSON.stringify(arr));
            renderArch();
        });
        await page.setViewport({ width: 430, height: 812, hasTouch: true });
        await sleep(400);
        const wide23 = await page.evaluate(() => {
            const grp = document.querySelector('.ca-arch-group');
            const head = grp.querySelector('.ca-arch-group-head');
            const amt = grp.querySelector('.ca-arch-amt');
            const hb = head.getBoundingClientRect(), ab = amt.getBoundingClientRect();
            return { side: ab.top < hb.bottom - 2, cells: amt.children.length, noClip: [...amt.children].every((c) => c.scrollWidth <= c.clientWidth + (c.classList.contains('ca-arch-mgtok') ? 5 : 1)) };
        });
        ok(wide23.side && wide23.cells === 6 && wide23.noClip, 'at 430px the three-row grid shares the row, as it now does even at 375px - the wrap guardrail only fires when a value truly runs long');
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        // v1.48.3: the display is every device's - dev off KEEPS the
        // surfaces (only the editor leaves), and the stored figures never
        // budge either way.
        await page.evaluate(() => { appDevMode = false; localStorage.setItem('crewAssist.devMode', 'false'); renderArch(); });
        await sleep(300);
        const hide31 = await page.evaluate(() => ({
            cells: (document.querySelector('.ca-arch-group .ca-arch-amt') || { children: [] }).children.length,
            expTxt: document.getElementById('ca-arch-exp-line').textContent,
            expHidden: document.getElementById('ca-arch-exp-line').classList.contains('hidden'),
            stored: JSON.parse(localStorage.getItem('crewAssist.archive')).find((e) => e.id === 'g1').detail.expense
        }));
        ok(hide31.cells === 6 && hide31.expTxt === 'Exp \u2212$120.00' && !hide31.expHidden && hide31.stored === 120, 'v1.48.3: dev off again - the display STAYS (the grid keeps its third row, the card its Exp line on its own row) while the stored figure sits untouched');
        ok(await page.evaluate(() => { openArchEntry('g1'); const ro = document.querySelector('[data-ca-arch-exp-row]'); return !!ro && ro.textContent.indexOf('$120.00') !== -1 && !document.getElementById('ca-arch-exp-btn'); }), 'v1.48.3: dev off again - the summary keeps the read-only statement, and the editor is gone');
        ok(await page.evaluate(() => { closeArchSub(); appDevMode = true; openArchEntry('g1'); return document.getElementById('ca-arch-exp-val') ? document.getElementById('ca-arch-exp-val').textContent : null; }) === '$120.00', 'v1.45.31: dev on - the receipt row returns pre-filled with the stored figure (Option A: display-only, never a data concern)');
        await page.evaluate(() => { localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); appDevMode = false; localStorage.setItem('crewAssist.devMode', 'false'); closeArchOverlay(); });
        await sleep(300);

        console.log('— v1.45.24: the menu hero on the true centre —');
        // The centre-axis rigidity, measured: the separator is a standalone
        // absolutely-centred layer between two strictly symmetrical halves,
        // so no text length on either side can move the track. The arrival
        // city is the owner's own worst case (SIEM REAP ANGKOR).
        const heroDate = await page.evaluate(() => {
            const dt = new Date(); dt.setDate(dt.getDate() + 7);
            const d = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            const fd = { departureAirportCode: 'SIN', departureCityName: 'SINGAPORE', arrivalAirportCode: 'REP', arrivalCityName: 'SIEM REAP ANGKOR', departureLocalDate: d + ' 09:20:00', arrivalLocalDate: d + ' 10:45:00', departureUtcDate: d + ' 01:20:00', arrivalUtcDate: d + ' 03:45:00', flightDuration: '2h 25m' };
            const data = { statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL'], legs: [{ flightDetails: fd }] };
            localStorage.setItem('SQ836:' + d + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: data }));
            localStorage.setItem('SQ836:' + d + ':JCL', JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, legs: [{ flightDetails: fd }] } }));
            return d;
        });
        await page.evaluate((d) => openNextFlightViewer('836', d), heroDate);
        await sleep(600);
        await page.setViewport({ width: 375, height: 812, hasTouch: true });
        await sleep(400);
        const hero = await page.evaluate(() => {
            const dep = document.querySelector('#menu-hero-content .ca-menu-hero-dep');
            const arr = document.querySelector('#menu-hero-content .ca-menu-hero-arr');
            const isle = document.querySelector('#menu-hero-content .ca-menu-hero-isle');
            if (!dep || !arr || !isle) return { none: true };
            const row = dep.parentElement;
            const depCity = dep.querySelector('.truncate'), arrCity = arr.querySelector('.truncate');
            const pill = isle.querySelector('.ca-micro');
            const plane = isle.querySelector('i[data-lucide="plane"]');
            const arc = isle.children[0];
            const rb = row.getBoundingClientRect(), ib = isle.getBoundingClientRect(), db = dep.getBoundingClientRect(), xb = arr.getBoundingClientRect();
            const pcb = depCity.getBoundingClientRect(), acb = arrCity.getBoundingClientRect(), pb = pill.getBoundingClientRect();
            const cs = (el) => getComputedStyle(el);
            return { none: false,
                x: Math.abs((ib.left + ib.right) / 2 - (rb.left + rb.right) / 2),
                y: Math.abs((ib.top + ib.bottom) / 2 - (rb.top + rb.bottom) / 2),
                halves: Math.abs(db.width - xb.width) <= 0.5,
                pill1: pb.height <= 28, pillWrap: cs(pill).whiteSpace === 'nowrap',
                clearDep: (ib.left - pcb.right) >= 4, clearArr: (acb.left - ib.right) >= 4,
                depR: cs(dep.querySelector('.text-2xl')).textAlign === 'right', arrL: cs(arr.querySelector('.text-2xl')).textAlign === 'left',
                ellip: cs(depCity).textOverflow === 'ellipsis' && cs(depCity).overflow === 'hidden' && cs(arrCity).textOverflow === 'ellipsis',
                plane: !!plane, arcDot: cs(arc).borderTopStyle === 'dotted',
                noWide: document.getElementById('menu-sector-content').scrollWidth <= document.getElementById('menu-sector-content').clientWidth + 1 };
        });
        ok(!hero.none && hero.x <= 0.5 && hero.y <= 0.5, 'v1.45.24 at 375px: the separator island sits on the stations row\u2019s TRUE centre, both axes (x off ' + (hero.x || 0).toFixed(2) + 'px, y off ' + (hero.y || 0).toFixed(2) + 'px)');
        ok(hero.halves && hero.depR && hero.arrL, 'the station columns are strictly identical halves - departure right-aligned, arrival left-aligned toward the track');
        ok(hero.pill1 && hero.pillWrap, 'the duration pill never wraps and never drops lines');
        ok(hero.clearDep && hero.clearArr, 'both city lines keep the safety clearance off the centre island (dep ' + (hero.clearDep ? 'ok' : 'clip') + ' / arr ' + (hero.clearArr ? 'ok' : 'clip') + ')');
        ok(hero.ellip && hero.noWide, 'long city names ellipsize under the truncate triple instead of pushing the columns - nothing scrolls sideways');
        ok(hero.plane && hero.arcDot, 'the plane rides the dotted arc apex inside the island');
        // v1.45.33 (owner order): the lightbox answers a two-finger pinch -
        // ONE unified engine, proven with real multi-touch in real Chromium
        // (CDP touch points, two ids)
        await page.evaluate(() => openMenuLightbox('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
        await sleep(300);
        const lbOpen33 = Date.now();
        ok(await page.evaluate(() => { const h = document.getElementById('menu-lightbox-hint'); return h && !h.classList.contains('opacity-0') && h.textContent === 'Pinch to zoom & pan' && getComputedStyle(h).fontSize === '11px'; }), 'v1.45.33: the hint mounts visible - quiet 11px micro text, centered at the bottom');
        const cdp33 = await page.createCDPSession();
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 300, id: 1 }, { x: 260, y: 300, id: 2 }] });
        await sleep(150);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60, y: 260, id: 1 }, { x: 320, y: 340, id: 2 }] });
        await sleep(150);
        const pinch33 = await page.evaluate(() => document.getElementById('menu-lightbox-img').style.transform);
        ok((() => { const m = (pinch33 || '').match(/translate\(([\d.-]+)px, ([\d.-]+)px\) scale\(([\d.]+)\)/); return !!m && Number(m[1]) === 10 && Number(m[2]) === 0 && Math.abs(Number(m[3]) - 1.7002) < 1e-6; })(), 'v1.45.33: the real two-finger pinch tracks both engines at once - the spread scales around the pivot while the midpoint pans (got ' + pinch33 + ')');
        // jsdom keeps the raw inline string; Chromium re-serializes through
        // the CSSOM without trailing zeros (10px, scale(1)) - parse the
        // numbers, never pin the spelling
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(200);
        ok(await page.evaluate(() => document.getElementById('menu-lightbox-img').classList.contains('ca-lb-snap')), 'v1.45.33: the release springs the image home through the gentle elastic ease-out');
        ok(await page.evaluate(() => !document.getElementById('menu-lightbox').classList.contains('hidden')), 'v1.45.33: the gesture\u2019s trailing release never closes the view');
        await sleep(400);
        const back33 = await page.evaluate(() => document.getElementById('menu-lightbox-img').style.transform);
        ok((() => { const m = (back33 || '').match(/translate\(([\d.-]+)px, ([\d.-]+)px\) scale\(([\d.]+)\)/); return !!m && Number(m[1]) === 0 && Number(m[2]) === 0 && Number(m[3]) === 1; })(), 'v1.45.33: the image rests back at its baseline centered fit (got ' + back33 + ')');
        await sleep(2200);
        ok(await page.evaluate(() => document.getElementById('menu-lightbox-hint').classList.contains('opacity-0')), 'v1.45.33: exactly three seconds from mount, the hint fades to nothing');
        await page.evaluate(() => document.getElementById('menu-lightbox-img').click());
        await sleep(400);
        ok(await page.evaluate(() => document.getElementById('menu-lightbox').classList.contains('hidden')), 'v1.45.33: a plain tap on the image exits the view');
        // v1.45.35 (owner report: "sometimes I cannot exit out of the image
        // by tapping outside of the image"): the old engine's lone-pointer
        // pointerdown cancelled the only timer that ever cleared the exit
        // guard - one quick tap inside the 460ms window and the guard stuck
        // true FOREVER (no tap, veil or image, could ever close the view
        // again). Prove the fix in the real browser: pinch, release, then a
        // fresh one-finger tap on the VEIL while the guard window is live
        await page.evaluate(() => openMenuLightbox('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
        await sleep(300);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 300, id: 1 }, { x: 260, y: 300, id: 2 }] });
        await sleep(150);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60, y: 260, id: 1 }, { x: 320, y: 340, id: 2 }] });
        await sleep(100);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(120);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 12, y: 500, id: 3 }] });
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => document.getElementById('menu-lightbox').classList.contains('hidden'), { timeout: 5000 });
        ok(true, 'v1.45.35: a quick tap on the veil right after the pinch closes the view - a deliberate tap is never the pinch\u2019s trailing click, and the guard can never stick (the owner bug)');
        // v1.58.0 (owner order): hold, then swipe up or down exits the image
        // view - a real held press in real Chromium (CDP touch, one id)
        await page.evaluate(() => openMenuLightbox('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
        await sleep(300);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 400, id: 4 }] });
        await sleep(420);   // past the 300ms hold arm
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 490, id: 4 }] });
        await page.waitForFunction(() => document.getElementById('menu-lightbox').classList.contains('opacity-0'), { timeout: 5000 });
        ok(true, 'v1.58.0: a held press that swipes down exits the image view - the owner\u2019s third door');
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => document.getElementById('menu-lightbox').classList.contains('hidden'), { timeout: 5000 });
        // a swipe without the hold never exits: the press wanders first
        await page.evaluate(() => openMenuLightbox('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
        await sleep(300);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 400, id: 5 }] });
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 500, id: 5 }] });   // before the hold arms - a drag
        await sleep(420);
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 620, id: 5 }] });
        await sleep(300);
        ok(await page.evaluate(() => !document.getElementById('menu-lightbox').classList.contains('opacity-0')), 'v1.58.0: a press that wanders before its hold arms is a drag - it never exits');
        await cdp33.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.evaluate(() => closeMenuLightbox());
        await sleep(400);
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        await page.evaluate((d) => { closeMenuViewer(); localStorage.removeItem('SQ836:' + d + ':CABINS'); localStorage.removeItem('SQ836:' + d + ':JCL'); }, heroDate);
        await sleep(300);

        // v1.45.46 (owner report, iPhone 11 - the flat 10): the records fit
        // must measure a VISIBLE sheet. The old order rendered while the wrap
        // was still display:none - clientHeight read 0, and every screen fell
        // to the no-layout fallback (7 rows, 10 entries, tall or short). Seed
        // a fourteen-station store, open records at two window heights, and
        // the SHORTER window must fit FEWER rows (with the bug both opens
        // returned the flat 7 and this pin fails).
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        await page.evaluate(() => {
            const ST = ['KUL', 'NRT', 'CPT', 'JNB', 'SYD', 'LHR', 'PVG', 'CGK', 'BOM', 'AKL', 'FRA', 'HKG', 'TPE', 'ICN'];
            const fls = [];
            ST.forEach((st, i) => {
                const d = String(i * 2 + 1).padStart(2, '0');
                fls.push({ fn: String(100 + i), dep: 'SIN', arr: st, ymd: '2026-10-' + d, std: '08:00', sta: '12:00', stdYmd: '2026-10-' + d, staYmd: '2026-10-' + d, ft: '04:00', ac: '7M8', rpt: '06:00', pos: false });
                fls.push({ fn: String(101 + i), dep: st, arr: 'SIN', ymd: '2026-10-' + d, std: '20:00', sta: '23:00', stdYmd: '2026-10-' + d, staYmd: '2026-10-' + d, ft: '04:00', ac: '7M8', rpt: '', pos: false });
            });
            localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': fls }));
            openRcPod();
        });
        await sleep(700);
        // v1.45.51 (owner order): the fit is scrapped — the depth is the
        // fixed TOP TEN on every screen height. Same 14-station store on
        // both windows: ranks four through ten (7 rows) tall AND short.
        const tallRows = await page.evaluate(() => document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length);
        await page.evaluate(() => closeRcPod());
        await sleep(600);
        await page.setViewport({ width: 390, height: 620, hasTouch: true });
        await sleep(300);
        await page.evaluate(() => { openRcPod(); document.getElementById('ca-rc-pod-gate').click(); });
        await sleep(700);
        const shortRows = await page.evaluate(() => document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length);
        await page.evaluate(() => closeRcPod());
        await sleep(500);
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(200);
        ok(tallRows === 7 && shortRows === 7, 'v1.45.51: the leaderboard depth is the fixed top ten - 7 rows (ranks four through ten) on the tall window AND the short one, no viewport math (' + shortRows + ' short vs ' + tallRows + ' tall)');

        // v1.48.3 (owner order): the My Flight Stats page ROLLS its counts
        // and dates the departure-board way - computed in the real browser,
        // under ca-reduced at that (the owner's exception: the roll answers
        // to no reduced-motion gate). The roll fires only once the sheet is
        // fully up; digits only; the year pills, the 2nd/3rd ordinals, the
        // row ranks and the View-all count never roll.
        await page.evaluate(() => { document.documentElement.classList.add('ca-reduced'); openRcPod(); document.getElementById('ca-rc-pod-gate').click(); });
        await sleep(100);
        const rollEarly = await page.evaluate(() => document.querySelectorAll('#ca-rc-stat-sheet .ca-rollc').length);
        await sleep(700);
        const rollState = await page.evaluate(() => {
            const q = (s) => document.querySelectorAll('#ca-rc-stat-sheet ' + s);
            return {
                cnt: q('.ca-rc-pod-count .ca-rollc, .ca-rc-pod-lcount .ca-rollc').length,
                ldate: q('.ca-rc-pod-ldate .ca-rollc').length,
                pills: q('#ca-rc-pod-listyears .ca-rollc').length,
                ranks: q('.ca-rc-pod-lrank .ca-rollc, .ca-rc-pod-ord .ca-rollc').length,
                all: q('.ca-rc-pod-all .ca-rollc').length,
                xHolds: !!document.querySelector('#ca-rc-stat-sheet .ca-rc-pod-count .ca-rc-pod-x, #ca-rc-stat-sheet .ca-rc-pod-lcount .ca-rc-pod-x')
            };
        });
        // v1.48.4 (owner order): a year-pill change rolls the numbers TOO —
        // computed in the real browser, still under ca-reduced (the exception
        // holds on the change roll as well)
        const pillRoll = await page.evaluate(() => {
            const y = Array.from(document.querySelectorAll('#ca-rc-pod-listyears .ca-rc-pod-ypill')).find((b) => b.textContent === '2026');
            if (y) y.click();
            return !!y;
        });
        await sleep(150);
        const pillState = await page.evaluate(() => {
            const q = (s) => document.querySelectorAll('#ca-rc-stat-sheet ' + s);
            return { cnt: q('.ca-rc-pod-count .ca-rollc, .ca-rc-pod-lcount .ca-rollc').length, ldate: q('.ca-rc-pod-ldate .ca-rollc').length, pills: q('#ca-rc-pod-listyears .ca-rollc').length };
        });
        ok(pillRoll && pillState.cnt > 0 && pillState.ldate > 0 && pillState.pills === 0, 'v1.48.4 (owner order): a year-pill change ROLLS the counts and dates again \u2014 immediately, and the pills themselves never carry a reel');
        // v1.48.5 (owner order): the flights pills roll too — the All Flights /
        // Layovers tabs ride the same roll (the SYD overnight seeds the lo list)
        const tabRoll = await page.evaluate(() => { const t = document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]'); if (t) t.click(); return !!t; });
        await sleep(150);
        const tabState = await page.evaluate(() => {
            const q = (s) => document.querySelectorAll('#ca-rc-stat-sheet ' + s);
            return { cnt: q('.ca-rc-pod-count .ca-rollc, .ca-rc-pod-lcount .ca-rollc').length, ldate: q('.ca-rc-pod-ldate .ca-rollc').length };
        });
        ok(tabRoll && tabState.cnt > 0 && tabState.ldate > 0, 'v1.48.5 (owner order): the flights pills \u2014 the tabs \u2014 ROLL the numbers too, computed in the real browser');
        await page.evaluate(() => { document.documentElement.classList.remove('ca-reduced'); closeRcStat(); closeRcPod(); });
        await sleep(400);
        ok(rollEarly === 0, 'v1.48.3: the stats page mounts settled - the roll waits out the sheet\'s glide (the v1.48.0 arm pattern)');
        ok(rollState.cnt > 0 && rollState.ldate > 0 && rollState.xHolds, 'v1.48.3 (owner order): once the sheet is up, the counts and dates reel - and in the count the \u00d7 glyph stands still beside the digits');
        ok(rollState.pills === 0 && rollState.ranks === 0 && rollState.all === 0, 'v1.48.3: the year pills, the 2nd/3rd ordinals, the row ranks and the View-all count never roll');

        // v1.45.47 (owner green light, after six external specs): the
        // chevron affordance — rows only, turning down toward the log it
        // reveals — plus the tab-pill reset (fold every log, scroll home).
        // The 14-station store is still seeded; records is closed here.
        // v1.45.52: the gateway reopens collapsed — open it for the scroll pins
        await page.evaluate(() => { openRcPod(); document.getElementById('ca-rc-pod-gate').click(); });
        await sleep(600);
        ok(await page.evaluate(() => {
            const r = document.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow');
            if (!r) return false;
            const c = getComputedStyle(r, '::after');
            return !!c.content && c.content.indexOf('›') >= 0 && c.transform === 'none' && getComputedStyle(r).paddingLeft === '8px';
        }), 'v1.45.47: every row carries the chevron glyph at its right edge (computed pseudo-element, at rest un-rotated) and the row breathes at 8px');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow').click());
        await sleep(400);
        ok(await page.evaluate(() => {
            const r = document.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow.ca-rc-pod-on');
            if (!r) return false;
            return getComputedStyle(r, '::after').transform !== 'none';
        }), 'v1.45.47: the open row\u2019s chevron turns down toward the log it reveals (computed rotation)');
        await page.evaluate(() => {
            const b = document.getElementById('ca-rc-pod-body');
            if (b.scrollTop < 100) { const door = document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]'); if (door) door.click(); }
        });
        await sleep(300);
        ok(await page.evaluate(() => { const b = document.getElementById('ca-rc-pod-body'); b.scrollTop = 140; return b.scrollTop >= 100; }), 'the records body really scrolls once the list is deep (the precondition the reset pin rides on)');
        await page.evaluate(() => document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click());
        await sleep(400);
        ok(await page.evaluate(() => {
            const b = document.getElementById('ca-rc-pod-body');
            return b.scrollTop === 0 && !document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]') && !document.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow.ca-rc-pod-on');
        }), 'v1.45.47 (owner order): the new pill folds the log, clears the ring and scrolls the body home - a fresh page');
        await page.evaluate(() => closeRcPod());
        await sleep(400);


        console.log('— health —');
        eq(pageErrors.length, 0, 'zero page errors' + (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));
        eq(consoleErrors.length, 0, 'zero console errors (CDN blocks excluded)' + (consoleErrors.length ? ' — ' + consoleErrors.join(' | ') : ''));
    } finally {
        await browser.close();
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    if (fail) { console.log('fails:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
