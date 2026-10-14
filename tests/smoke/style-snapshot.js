// Computed-style snapshot rig (v1.44.4 round): the zero-surprise proof for
// the colour-token normalization sweep. Boots the REAL app in the REAL
// Chromium (same engine the smoke rig uses), renders a deterministic set of
// surfaces, and snapshots every element's computed colour properties — in
// the dark theme AND the light theme, ::before/::after included. Run it
// once before a CSS change and once after; style-diff.js compares the two
// JSONs and flags EVERY computed-style difference. Same values in, same
// values out — the sweep must produce a zero-diff report.
//
// Usage: node style-snapshot.js <out.json>
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const out = process.argv[2];
if (!out) { console.error('usage: node style-snapshot.js <out.json>'); process.exit(1); }

// chromium libs (same extraction the smoke runner does)
const { execSync } = require('child_process');
const libsDir = '/tmp/chr-libs/lib';
if (!fs.existsSync(path.join(libsDir, 'libnspr4.so'))) {
    fs.mkdirSync(libsDir, { recursive: true });
    const br = path.join(__dirname, 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br');
    fs.writeFileSync('/tmp/al2023.tar', require('zlib').brotliDecompressSync(fs.readFileSync(br)));
    execSync('tar -xf /tmp/al2023.tar -C /tmp/chr-libs');
}
process.env.LD_LIBRARY_PATH = [libsDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const server = spawn('node', [path.join(__dirname, 'server.js')], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium').default;
    const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'] });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        try {
            localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Snap', gender: 'Male', rank: 'FS' }));
            localStorage.setItem('crewAssist.wnSeen', document.currentScript ? '' : '');
        } catch (e) {}
    });
    // wnSeen must match the RUNNING app version (set after boot via reload trick is overkill —
    // the What's New popup is culled from the diff anyway); seed a bogus future version so it
    // never auto-opens in either run.
    await page.evaluateOnNewDocument(() => {
        try {
            localStorage.setItem('crewAssist.wnSeen', '9.9.9');
            localStorage.setItem('crewAssist.calcUi', 'manual');
            // seeded duties (the smoke's calendar seeds) so the roster
            // calendar renders real rows, tags, badges and tracks
            localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [
                { ymd: '2026-10-09', kind: 'fly', code: '', loc: '', fns: ['231'], dkey: 'k1' },
                { ymd: '2026-10-10', kind: 'fly', code: '', loc: '', fns: ['232'], dkey: 'k1' },
                { ymd: '2026-10-12', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k2' },
                { ymd: '2026-10-13', kind: 'sb', code: '', loc: '', fns: [], dkey: 'k4' },
            ] }));
            localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
                { fn: '231', dep: 'SIN', arr: 'SYD', ymd: '2026-10-09', std: '09:00', sta: '19:05', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '08:05', ac: '359', rpt: '', pos: false },
                { fn: '232', dep: 'SYD', arr: 'SIN', ymd: '2026-10-10', std: '07:30', sta: '13:40', stdYmd: '2026-10-10', staYmd: '2026-10-10', ft: '08:10', ac: '359', rpt: '', pos: false },
                { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:10', ac: '7M8', rpt: '', pos: false },
                { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-12', std: '10:25', sta: '11:45', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:20', ac: '7M8', rpt: '', pos: false },
            ] }));
        } catch (e) {}
    });
    await page.goto('http://127.0.0.1:8799/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(1500);

    // deterministic surface renders: calculator card (inputs, pills, date
    // buttons), next-flight nudge, the roster calendar (seeded duties:
    // rows, tags, badges, tracks), the changelog sheet (the ca-cl family),
    // the earnings archive (the ca-arch family), the settings sheet, and
    // the date picker (day cells, is-sel).
    await page.evaluate(() => {
        renderCalculatorCard('both');
        renderNextFlightCard();
        openRosterCalendar();
        openChangelog();
        openArchOverlay();
    });
    await sleep(400);
    await page.evaluate(() => { const b = document.getElementById('btn-settings'); if (b) b.click(); });
    await sleep(900);
    await page.evaluate(() => {
        const i = document.createElement('input');
        i.value = '2026-10-15';
        openCaDatePicker(i, false, null, '');
    });
    await sleep(600);
    // transient chat elements: the typing indicator rides a few-second
    // timer and the round-31 confirm card auto-dismisses after 7s — let
    // both live out their lives before snapshotting, or element paths
    // drift run-to-run
    await sleep(9000);
    // quiescence: anything left must be fully settled
    for (let i = 0; i < 14; i++) {
        const a = await page.evaluate(() => document.documentElement.outerHTML.length);
        await sleep(500);
        const b = await page.evaluate(() => document.documentElement.outerHTML.length);
        if (a === b) break;
    }
    // freeze all animation/transition at the base state: the pulse dot and
    // fade-ins otherwise report race-y mid-animation values (and the theme
    // switch would ride a colour transition). The sweep only touches static
    // declarations, so the frozen state is exactly what it must preserve.
    await page.evaluate(() => {
        const s = document.createElement('style');
        s.id = 'snapshot-freeze';
        s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(s);
    });
    await sleep(250);

    const capture = () => page.evaluate(() => {
        // opacity is EXCLUDED on purpose: the composer's entrance is a JS
        // tween (not a CSS animation the freeze can pin), and the sweep never
        // touches the opacity property — only colour literals.
        const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'textDecorationColor', 'caretColor', 'fill', 'stroke'];
        const pathOf = (el) => {
            const parts = [];
            while (el && el !== document.documentElement) {
                const parent = el.parentElement;
                const tag = el.tagName.toLowerCase();
                if (el.id) parts.unshift(tag + '#' + el.id);
                else {
                    let n = 1, sib = el;
                    while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) n++;
                    parts.unshift(tag + (n > 1 ? ':nth-of-type(' + n + ')' : ''));
                }
                el = parent;
            }
            return 'html' + (parts.length ? '>' + parts.join('>') : '');
        };
        const read = (el, pseudo) => {
            const cs = getComputedStyle(el, pseudo);
            if (pseudo && cs.content === 'none') return null;
            const o = {};
            for (const p of PROPS) o[p] = cs[p];
            return o;
        };
        const out = [];
        const roots = [document.documentElement, document.body];
        for (const r of roots) {
            for (const el of [r, ...r.querySelectorAll('*')]) {
                if (['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'].includes(el.tagName)) continue;
                if (el.closest('#typing-indicator')) continue; // transient; glass colours verified elsewhere
                const e = { path: pathOf(el), tag: el.tagName, base: read(el, null) };
                const bef = read(el, '::before'), aft = read(el, '::after');
                if (bef) e.bef = bef;
                if (aft) e.aft = aft;
                out.push(e);
            }
        }
        return { url: location.pathname, count: out.length, els: out };
    });

    const themes = {};
    themes.dark = await capture();
    await page.evaluate(() => { document.documentElement.classList.remove('dark'); });
    await sleep(250);
    themes.light = await capture();

    fs.writeFileSync(out, JSON.stringify({ dark: themes.dark, light: themes.light }));
    console.log('snapshot written:', out, '| dark els:', themes.dark.count, '| light els:', themes.light.count);
    await browser.close();
    server.kill();
    process.exit(0);
})().catch((e) => { console.error('SNAPSHOT FAIL', e); server.kill(); process.exit(1); });
