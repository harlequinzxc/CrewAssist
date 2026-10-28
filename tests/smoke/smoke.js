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
        eq(await page.evaluate(() => window.APP_VERSION), '1.45.41', 'APP_VERSION is 1.45.41');
        ok(await page.evaluate(() => { const e = APP_CHANGELOG[0]; return e && e.v === '1.45.41' && e.d === '2026-10-29' && e.items.length === 1 && e.items[0].c === 'imp'; }), 'the changelog carries the 1.45.41 entry with its single pointer');
        ok((await page.evaluate(() => fetch('/sw.js').then((r) => r.text()))).includes('crewassist-v272'), 'the service-worker cache name is bumped to v272 (the v1.45.41 shuttle-fold release)');

        console.log('— what\'s new —');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        ok(await page.evaluate(() => { const heads = document.querySelectorAll('#whatsnew-list .ca-micro'); return heads.length && heads[0].textContent === 'v1.45.41'; }), 'the What\'s New sheet carries the v1.45.41 header');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('The earnings figure gets breathing room and a tidier stat grid.') !== -1), 'the What\'s New sheet carries the earnings-polish pointer');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Every remaining colour wash rides a named token — same look.') !== -1), 'the What\'s New sheet carries the 1.44.6 one-off retirement pointer (fifth head now)');
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

        // 7c. v1.45.34 (owner order): the changelog filter chips in the real
        // browser - the compact three-tier framework, and the painted fade.
        await page.evaluate(() => openChangelog());
        await page.waitForFunction(() => { const b = document.getElementById('ca-changelog-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 5000 });
        ok(await page.evaluate(() => [...document.querySelectorAll('#ca-cl-chips .ca-cl-chip')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'All|New|Fixes|Polish'), 'v1.45.34: the filter tokens read All / New / Fixes / Polish - the compact three-tier framework');
        ok(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('ca-cl-chips')); const m = cs.maskImage || cs.webkitMaskImage; return /linear-gradient\(to right, (?:rgba\(0, 0, 0, 0\)|transparent), (?:rgb\(0, 0, 0\)|black) 24px,/.test(m); }), 'v1.45.34: the chips rail fades at both edges - the 24px gradient mask paints on the scroll boundary, never on the hit targets (Chromium re-serializes the colors through the CSSOM)');
        ok(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('action-chips')); const m = cs.maskImage || cs.webkitMaskImage; return /linear-gradient\(to right, (?:rgba\(0, 0, 0, 0\)|transparent), (?:rgb\(0, 0, 0\)|black) 24px,/.test(m); }), 'v1.45.36: the chat\u2019s quick-action rail wears the SAME both-edge fade - one shared class, one visual language (computed in the real browser)');
        ok(await page.evaluate(() => { const v = document.querySelector('.ca-input-veil'); if (!v) return false; const cs = getComputedStyle(v); const wrap = v.parentElement.getBoundingClientRect(); const vr = v.getBoundingClientRect(); return cs.position === 'absolute' && cs.top === '92px' && Math.abs((vr.top - wrap.top) - 92) < 1 && cs.backgroundImage.indexOf('linear-gradient') === 0; }), 'v1.45.36: the veil is pinned at the chips\u2019 bottom edge (92px below the input wrapper\u2019s top) - the painted dark overlay no longer covers the chip zone, and the wrapper-growth math keeps the seam on the chips at every composer height');
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
        await page.waitForFunction(() => !document.getElementById('app-dialog-backdrop').classList.contains('hidden'), { timeout: 15000 });
        await page.evaluate(() => document.getElementById('app-dialog-ok').click());
        await sleep(400);

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
        ok(await page.evaluate(() => { const b = document.getElementById('ca-rc-pod'); return b && !b.classList.contains('hidden') && !!(b.querySelector('i[data-lucide="podium"]')); }), 'v1.45.38: the podium button is revealed carrying the podium icon (the rig blocks the CDN, so the pin reads the stub - the glyph itself is verified in the lucide bundle)');
        await page.evaluate(() => document.getElementById('ca-rc-pod').click());
        await sleep(600);
        ok(await page.evaluate(() => !document.getElementById('ca-rc-podwrap').classList.contains('hidden') && !document.getElementById('ca-rc-pod-sheet').classList.contains('translate-y-full')), 'v1.45.38: tapping the podium glides the records page up over the calendar');
        ok(await page.evaluate(() => { const tabs = document.querySelectorAll('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab]'); return tabs.length === 3 && tabs[0].textContent === 'All Flights' && tabs[0].classList.contains('ca-rc-pod-tabon') && getComputedStyle(document.querySelector('.ca-rc-pod-glider')).backgroundColor === 'rgb(201, 162, 39)'; }), 'v1.45.39: the segmented tab bar carries all three lists, All Flights rides the gliding gold pill (computed SIA gold, never Tailwind amber)');
        ok(await page.evaluate(() => document.getElementById('ca-rc-pod-subtitle').textContent === 'All-time \u00b7 since Oct 2026'), 'v1.45.39: the subtitle names the all-time window from the earliest flown leg');
        ok(await page.evaluate(() => { const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return cards.length === 2 && cards[1].classList.contains('ca-rc-pod-hero') && cards[1].textContent.indexOf('KUL') >= 0 && cards[1].textContent.indexOf('\u00d71') >= 0 && !!cards[1].querySelector('i[data-lucide="crown"]') && cards[0].textContent.indexOf('2nd') >= 0 && cards[0].textContent.indexOf('SYD') >= 0; }), 'v1.45.39: the 2-1-3 podium ranks the seeded truth as VISITS - KUL \u00d71 crowned center (the future November leg does NOT count: records are current to wheels-down), SYD 2nd at the side');
        ok(await page.evaluate(() => { const hero = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero'); const want = document.documentElement.classList.contains('dark') ? 'rgba(201, 162, 39, 0.12)' : 'rgba(201, 162, 39, 0.15)'; return hero.classList.contains('ca-rc-pod-d0') && getComputedStyle(hero).backgroundColor === want; }), 'v1.45.39: the hero card carries the mount stagger class and the theme-correct gold-soft wash (computed - 0.15 light, 0.12 dark)');
        ok(await page.evaluate(() => { const hero = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero'); return getComputedStyle(hero.querySelector('.ca-rc-pod-code')).fontSize === '20px'; }), 'v1.45.40: the hero code computes to 20px - the half-step scale-up, sized by the custom rule');
        ok(await page.evaluate(() => { const x = document.querySelector('#ca-rc-pod-body .ca-rc-pod-hero .ca-rc-pod-x'); return !!x && x.textContent === '\u00d7' && getComputedStyle(x).color === 'rgb(168, 162, 158)'; }), 'v1.45.40: the multiplier glyph steps back to stone ink (computed stone-400, the same in both themes) while the count stays bold');
        ok(await page.evaluate(() => !document.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]') && document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length === 0), 'v1.45.39: no leaderboard rows and no View-all door when the list fits the podium');
        ok(await page.evaluate(() => { const before = getComputedStyle(document.querySelector('.ca-rc-pod-glider')).transform; document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click(); const after = getComputedStyle(document.querySelector('.ca-rc-pod-glider')).transform; const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return before !== after && cards.length === 1 && cards[0].classList.contains('ca-rc-pod-hero') && cards[0].textContent.indexOf('SYD') >= 0 && !cards[0].classList.contains('ca-rc-pod-d0'); }), 'v1.45.39: tapping Layovers glides the pill across (computed transform moves) and swaps the panel INSTANT - SYD alone lays over, and the stagger never replays on a swap');
        ok(await page.evaluate(() => { document.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click(); const cards = document.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card'); return cards.length === 1 && cards[0].textContent.indexOf('KUL') >= 0; }), 'v1.45.39: the Turnarounds tab carries the quick-ground list');
        // both themes are a hard acceptance criterion: the sheet and the
        // hero card's fills must shift with the dark class (real var()
        // resolution - the gold-soft wash deepens from 0.15 to 0.12)
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
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-scope="all"]').click());
        await sleep(300);
        await page.evaluate(() => document.querySelector('.ca-arch-seg[data-mode="salary"]').click());
        await sleep(400);
        // two tracked months: gross = 2x(2600+125+340) + 200 = 6330;
        // cpf = .2x(2x2600 + 200) = 1080; net = 5250
        ok(await page.evaluate(() => document.getElementById('ca-arch-total').textContent === '$5,250.00'), 'with a basic set the net computes: gross 6330 - CPF 1080 = 5250');
        ok(await page.evaluate(() => document.getElementById('ca-arch-avglab').textContent.indexOf('Avg $') === 0), 'the chart paints its average line label');
        await page.evaluate(() => { closeArchOverlay(); localStorage.removeItem('crewAssist.archive'); localStorage.removeItem('crewAssist.archMode'); });

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
        // the ambient loop stops behind the ca-reduced gate
        const reducedSpin = await page.evaluate(() => {
            const h = document.documentElement;
            const ico = document.querySelector('.ca-arch-group-head i[data-lucide="refresh-cw"]');
            h.classList.add('ca-reduced');
            const name = getComputedStyle(ico).animationName;
            h.classList.remove('ca-reduced');
            return { stopped: name, back: getComputedStyle(ico).animationName };
        });
        eq(reducedSpin.stopped, 'none', 'the spin stops behind the ca-reduced gate');
        eq(reducedSpin.back, 'caArchLive', 'and resumes when the gate lifts');
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
        await sleep(300);
        const milestone17 = await page.evaluate(() => {
            const label = document.getElementById('ca-arch-m-ctx-label');
            const ctx = document.getElementById('ca-arch-m-ctx');
            const cs = label ? getComputedStyle(label) : null;
            return {
                label: label ? label.textContent : '',
                upper: cs ? cs.textTransform : '', track: cs ? cs.letterSpacing : '', size: cs ? cs.fontSize : '',
                html: ctx ? ctx.innerHTML : '', text: ctx ? ctx.textContent.trim() : '',
                cls: ctx ? ctx.className : ''
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
        await sleep(300);
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
        await sleep(300);
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
        await sleep(300);
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
        // v1.45.31 (owner order, Option A): every expense surface renders
        // only in Developer Mode. Dev off (the fresh boot): no Exp segment,
        // no after line, no third grid row - and the layover summary shows
        // no receipt row. Then the only door: ten taps on the brand.
        const gate31 = await page.evaluate(() => {
            const gl = document.getElementById('ca-arch-gross-line');
            const al = document.getElementById('ca-arch-after-line');
            const amt = document.querySelector('.ca-arch-group-head').closest('.ca-arch-group').querySelector('.ca-arch-amt');
            return { expSeg: gl.textContent.indexOf('Exp ') !== -1, afterHidden: al.classList.contains('hidden'), cells: amt ? amt.children.length : 0, hasAfter: !!(amt && amt.querySelector('.ca-arch-amt-after')) };
        });
        ok(gate31.expSeg === false && gate31.afterHidden && gate31.cells === 4 && gate31.hasAfter === false, 'v1.45.31: dev mode off - the card and the grid show no expense surface at all (Option A)');
        ok(await page.evaluate(() => { openArchEntry('x1'); return !document.getElementById('ca-arch-exp-btn'); }), 'v1.45.31: dev mode off - the layover summary carries no receipt row');
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
            const al = document.getElementById('ca-arch-after-line');
            const head = document.querySelector('.ca-arch-group-head').closest('.ca-arch-group').querySelector('.ca-arch-amt');
            const netV = head.querySelector('.ca-arch-amt-net'), grossV = head.querySelector('.ca-arch-amt-gross'), afterV = head.querySelector('.ca-arch-amt-after');
            return { mk, expSeg: gl.textContent.indexOf('Exp \u2212$120.00') !== -1, afterHidden: al.classList.contains('hidden'), afterTxt: al.textContent, afterWant: 'After expenses ' + fm(sal.net - 120),
                rows: head.children.length, afterVal: afterV ? afterV.textContent : '', afterWantVal: fm(sal.net - 120),
                edgeN: netV.getBoundingClientRect().right, edgeG: grossV.getBoundingClientRect().right, edgeA: afterV ? afterV.getBoundingClientRect().right : 0,
                rowLbl: afterV ? afterV.previousElementSibling.textContent : '', rowMuted: afterV ? getComputedStyle(afterV).color === getComputedStyle(grossV).color && getComputedStyle(afterV.previousElementSibling).color === getComputedStyle(grossV.previousElementSibling).color : false };
        });
        ok(exp22.expSeg, 'v1.45.22: the subtext gains the Exp segment beside Gross|CPF');
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
            seg: document.getElementById('ca-arch-gross-line').textContent.indexOf('Exp \u2212$88.50') !== -1,
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
        ok(await page.evaluate(() => document.getElementById('ca-arch-after-line').classList.contains('hidden') && document.getElementById('ca-arch-gross-line').textContent.indexOf('Exp ') === -1), 'the COP lens shows no expense context');
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
        // v1.45.31 (owner order, Option A): the gate is display-only - the
        // stored figures never budge while hidden, and dev on brings every
        // surface back pre-filled.
        await page.evaluate(() => { appDevMode = false; localStorage.setItem('crewAssist.devMode', 'false'); renderArch(); });
        await sleep(300);
        const hide31 = await page.evaluate(() => ({
            cells: (document.querySelector('.ca-arch-group .ca-arch-amt') || { children: [] }).children.length,
            expSeg: document.getElementById('ca-arch-gross-line').textContent.indexOf('Exp ') !== -1,
            stored: JSON.parse(localStorage.getItem('crewAssist.archive')).find((e) => e.id === 'g1').detail.expense
        }));
        ok(hide31.cells === 4 && hide31.expSeg === false && hide31.stored === 120, 'v1.45.31: dev off again - the grid drops its third row and the card its Exp segment, while the stored figure sits untouched');
        ok(await page.evaluate(() => { openArchEntry('g1'); return !document.getElementById('ca-arch-exp-btn'); }), 'v1.45.31: dev off again - the receipt row is gone from the summary');
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
        await page.setViewport({ width: 390, height: 844, hasTouch: true });
        await sleep(300);
        await page.evaluate((d) => { closeMenuViewer(); localStorage.removeItem('SQ836:' + d + ':CABINS'); localStorage.removeItem('SQ836:' + d + ':JCL'); }, heroDate);
        await sleep(300);

        console.log('— health —');
        eq(pageErrors.length, 0, 'zero page errors' + (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));
        eq(consoleErrors.length, 0, 'zero console errors (CDN blocks excluded)' + (consoleErrors.length ? ' — ' + consoleErrors.join(' | ') : ''));
    } finally {
        await browser.close();
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    if (fail) { console.log('fails:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
