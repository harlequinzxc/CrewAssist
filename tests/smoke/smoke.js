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
        page.on('requestfailed', (r) => { const u = r.url() || ''; if (!CDN.test(u) && !RIG404.test(u)) consoleErrors.push('requestfailed: ' + u); });

        console.log('— boot —');
        await page.evaluateOnNewDocument(() => { try { if (localStorage.getItem('__smokeFreshBoot')) return; localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' })); localStorage.setItem('crewAssist.wnSeen', '1.39.0'); localStorage.setItem('crewAssist.calcUi', 'manual'); } catch (e) {} });
        await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('#chat-container', { timeout: 20000 });
        ok(true, 'the app boots to the chat view');
        ok(await page.evaluate(() => { const el = document.getElementById('ca-shell-fail'); return !el || getComputedStyle(el).display === 'none'; }), 'the shell guard passes (tw.css loaded, no repair screen)');
        ok(await page.evaluate(() => { const el = document.querySelector('.ca-micro'); return el && parseFloat(getComputedStyle(el).fontSize) <= 11.5; }), 'the compiled stylesheet applies (ca-micro renders at 11px)');
        ok(await page.evaluate(() => { const h = document.documentElement; const wasDark = h.classList.contains('dark'); h.classList.remove('dark'); const s = document.createElement('span'); s.className = 'text-sia-gold'; s.textContent = '.'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); if (wasDark) h.classList.add('dark'); return c; }) === 'rgb(125, 101, 15)', 'light-mode gold text computes to the measured #7d650f ink (divergence #3b: the rule rides the var token)');

        console.log('— release stamps —');
        eq(await page.evaluate(() => window.APP_VERSION), '1.45.0', 'APP_VERSION is 1.45.0');
        ok(await page.evaluate(() => { const e = APP_CHANGELOG[0]; return e && e.v === '1.45.0' && e.d === '2026-10-15' && e.items.length === 1 && e.items[0].c === 'new'; }), 'the changelog carries the 1.45.0 motion entry');
        ok((await page.evaluate(() => fetch('/sw.js').then((r) => r.text()))).includes('crewassist-v231'), 'the service-worker cache name is bumped to v231 (the v1.45.0 motion release)');

        console.log('— what\'s new —');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        ok(await page.evaluate(() => { const heads = document.querySelectorAll('#whatsnew-list .ca-micro'); return heads.length && heads[0].textContent === 'v1.45.0'; }), 'the What\'s New sheet carries the v1.45.0 header');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Every remaining colour wash rides a named token — same look.') !== -1), 'the What\'s New sheet carries the 1.44.6 one-off retirement pointer (fourth head now)');
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
            const rows = Array.from(card.querySelectorAll('[data-ca-help-cmd]'));
            const t = card.textContent.replace(/\s+/g, ' ');
            return rows.length === 4 && rows.map((r) => r.getAttribute('data-ca-help-cmd')).join(',') === 'menu,ifa,lma,cop'
                && t.indexOf('Quick shortcuts') !== -1 && t.indexOf('Type or tap any command below') !== -1;
        }), 'typing help answers with the structured card — four rows in order, title + subtitle');
        // The rig serves no CDN (lucide ships from unpkg — blocked by policy),
        // so icons stay <i data-lucide> stubs here. The contract this layer
        // can pin: every glyph the card declares is a named Lucide icon —
        // bulb, four category icons, three tip dots, the CTA arrow — no
        // emoji, no custom SVG anywhere in the card.
        ok(await page.evaluate(() => {
            const card = document.querySelector('[data-ca-help-card]');
            const names = Array.from(card.querySelectorAll('i[data-lucide]')).map((i) => i.getAttribute('data-lucide'));
            const need = ['lightbulb', 'utensils', 'calculator', 'sandwich', 'map', 'dot', 'dot', 'dot', 'arrow-right'];
            return names.length === 9 && need.every((n) => names.indexOf(n) !== -1) && !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}]/u.test(card.textContent);
        }), 'the card declares only Lucide glyphs — bulb, four category icons, three tip dots, the CTA arrow — and no emoji');
        // A real tap on a row: the keyword lands in the composer, focus
        // follows, and the row flashes gold (then the flash fades on its own).
        // Wait for idle first — while the chat is busy every chat button is
        // pointer-inert (the anti-double-fire rule), so a mid-typing tap
        // would rightly be swallowed.
        await page.waitForFunction(() => !isChatBusy(), { timeout: 20000 });
        await page.click('[data-ca-help-cmd="menu"]');
        ok(await page.evaluate(() => {
            const row = document.querySelector('[data-ca-help-cmd="menu"]');
            const inp = document.getElementById('chat-input');
            return inp.value === 'menu ' && document.activeElement === inp && row.classList.contains('ca-help-flash');
        }), 'a real tap inserts "menu " into the composer, focuses it, and flashes the row gold');
        await new Promise((r) => setTimeout(r, 600));
        ok(await page.evaluate(() => !document.querySelector('[data-ca-help-cmd="menu"]').classList.contains('ca-help-flash')), 'the gold flash fades on its own — no stuck state');
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
        ok(await page.evaluate(() => localStorage.getItem('crewAssist.tourDone') === '1'), 'hotfix: a restoring user is not offered the tour');
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
            return ['btn-edit-profile', 'btn-replay-tour', 'btn-changelog'].every((id) => Math.abs(wd(document.getElementById(id)) - tg) < 1.5);
        }), 'hotfix: Edit, Replay, View and Telegram render one width (the compiled stylesheet carries w-32)');
        await page.evaluate(() => closeSettings());

        // 7b. v1.45.0 (divergence #1a + the owner's binary toggle): reduced
        // motion — the OS switch lands the marker, the toggle overrides it,
        // and a cleared key goes back to following the OS.
        ok(await page.evaluate(() => !document.documentElement.classList.contains('ca-reduced')), 'normal boot: full motion, no ca-reduced marker');
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        ok(await page.evaluate(() => {
            const mk = (cls) => { const p = document.createElement('div'); p.className = cls; document.body.appendChild(p); const n = getComputedStyle(p).animationName; p.remove(); return n; };
            return mk('chat-anim-in') === 'ca-reduce-fade' && mk('animate-pulse') === 'none';
        }), 'OS reduce: entries collapse to ca-reduce-fade, loops stop');
        ok(await page.evaluate(() => getComputedStyle(document.getElementById('settings-sheet')).transitionDuration === '0s'), 'OS reduce: sheets snap open (transition-transform gated)');
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        ok(await page.evaluate(() => document.getElementById('motion-pill-reduced').getAttribute('aria-checked') === 'true' && document.getElementById('motion-pill-full').getAttribute('aria-checked') === 'false' && document.getElementById('motion-desc').textContent.indexOf('following') !== -1), 'the toggle mirrors the resolved state (Reduced, following the OS)');
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
        await sleep(60);
        ok(await page.evaluate(() => document.getElementById('ca-rc-grid').classList.contains('rc-tags-out') && getComputedStyle(document.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag')).animationName === 'ca-rc-popout' && getComputedStyle(document.getElementById('ca-rc-shot')).animationName === 'ca-rc-btnout'), 'hotfix: hiding pops the marks back out — and the camera button pops out with them');
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

        console.log('— health —');
        eq(pageErrors.length, 0, 'zero page errors' + (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));
        eq(consoleErrors.length, 0, 'zero console errors (CDN blocks excluded)' + (consoleErrors.length ? ' — ' + consoleErrors.join(' | ') : ''));
    } finally {
        await browser.close();
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    if (fail) { console.log('fails:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
