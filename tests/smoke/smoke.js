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
    const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args, headless: chromium.headless, defaultViewport: { width: 390, height: 844 } });
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

        console.log('— release stamps —');
        eq(await page.evaluate(() => window.APP_VERSION), '1.42.0', 'APP_VERSION is 1.42.0');
        ok(await page.evaluate(() => { const e = APP_CHANGELOG[0]; return e && e.v === '1.42.0' && e.d === '2026-10-08' && e.items.length === 6 && e.items.map((i) => i.c).join(',') === 'new,fix,fix,fix,fix,fix'; }), 'the changelog carries the extended 1.42.0 entry (welcome restore + hotfix round)');
        ok((await page.evaluate(() => fetch('/sw.js').then((r) => r.text()))).includes('crewassist-v201'), 'the service-worker cache name is bumped to v201 (APP_VERSION 1.42.0, hotfix round)');

        console.log('— what\'s new —');
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        ok(await page.evaluate(() => { const heads = document.querySelectorAll('#whatsnew-list .ca-micro'); return heads.length && heads[0].textContent === 'v1.42.0'; }), 'the What\'s New sheet carries the v1.42.0 header');
        ok(await page.evaluate(() => document.getElementById('whatsnew-list').innerText.indexOf('Transits of three hours or more now earn location meals.') !== -1), 'the What\'s New sheet carries the transit-meals pointer');
        ok(await page.evaluate(() => (document.getElementById('whatsnew-list').innerText.match(/1\.42\.0/g) || []).length === 1), 'the version appears exactly once (the white duplicate line is gone)');
        await page.click('#whatsnew-close');
        await page.waitForFunction(() => document.getElementById('chat-container').innerText.trim().length > 20, { timeout: 15000 });
        ok(true, 'closing What\'s New releases the welcome chat');

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

        console.log('— health —');
        eq(pageErrors.length, 0, 'zero page errors' + (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));
        eq(consoleErrors.length, 0, 'zero console errors (CDN blocks excluded)' + (consoleErrors.length ? ' — ' + consoleErrors.join(' | ') : ''));
    } finally {
        await browser.close();
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    if (fail) { console.log('fails:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
