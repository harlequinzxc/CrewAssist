// round 16 spot-diag: why did the tail "toggle is exempt" pin lose its gold?
// mirrors the smoke tail exactly (including the round-16 viewport dance)
const puppeteer = require('puppeteer-core');
process.env.LD_LIBRARY_PATH = ['/tmp/chr-libs/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
const chromium = require('@sparticuz/chromium').default;
const BASE = 'http://127.0.0.1:8799';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const exe = await chromium.executablePath();
    const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args, headless: chromium.headless, defaultViewport: { width: 390, height: 844, hasTouch: true } });
    const page = await browser.newPage();
    await page.emulateTimezone('Asia/Singapore');
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' })); localStorage.setItem('crewAssist.wnSeen', '1.39.0'); localStorage.setItem('crewAssist.calcUi', 'manual'); } catch (e) {} });
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#chat-container', { timeout: 20000 });
    await sleep(400);
    await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); if (b && !b.classList.contains('hidden')) { const c = document.getElementById('whatsnew-close'); if (c) c.click(); } });
    await sleep(300);
    await page.evaluate(() => {
        localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [ { ymd: '2026-10-12', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k2' } ] }));
        localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [ { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:10', ac: '7M8', rpt: '', pos: false }, { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-12', std: '10:25', sta: '11:45', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:20', ac: '7M8', rpt: '', pos: false } ] }));
    });
    const state = () => page.evaluate(() => {
        const t = document.getElementById('ca-rc-tag');
        return { cls: t.className, bg: getComputedStyle(t).backgroundColor, pad: getComputedStyle(t).paddingLeft };
    });
    await page.evaluate(() => openRosterCalendar());
    await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden'), { timeout: 5000 });
    await sleep(600);
    await (await page.$('#ca-rc-tag')).tap();
    await sleep(300);
    console.log('after first tap       ', JSON.stringify(await state()));
    await page.setViewport({ width: 375, height: 844, hasTouch: true });
    await sleep(300);
    console.log('after viewport 375    ', JSON.stringify(await state()));
    await page.setViewport({ width: 390, height: 844, hasTouch: true });
    await sleep(300);
    console.log('after viewport 390    ', JSON.stringify(await state()));
    await page.evaluate(() => document.getElementById('ca-rc-fold').click());
    await sleep(600);
    await page.evaluate(() => document.getElementById('ca-rc-close').click());
    await sleep(800);
    console.log('closed, tag hidden?   ', await page.evaluate(() => document.getElementById('ca-rc-tag').classList.contains('hidden')));
    await page.evaluate(() => { const b = document.getElementById('whatsnew-backdrop'); if (b && !b.classList.contains('hidden')) document.getElementById('whatsnew-close').click(); });
    await page.evaluate(() => { const dl = document.getElementById('app-dialog-backdrop'); if (dl && !dl.classList.contains('hidden')) document.getElementById('app-dialog-ok').click(); });
    await sleep(400);
    await page.waitForFunction(() => !document.documentElement.classList.contains('chat-busy'), { timeout: 20000 });
    await sleep(300);
    await (await page.$('#btn-roster-cal')).tap();
    await sleep(300);
    await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden') && !document.getElementById('ca-rc-tag').classList.contains('hidden') && document.getElementById('ca-rc-tag').getBoundingClientRect().top > 0, { timeout: 8000 });
    await sleep(400);
    console.log('reopened              ', JSON.stringify(await state()));
    const box = await (await page.$('#ca-rc-tag')).boundingBox();
    console.log('tag box               ', JSON.stringify(box));
    await (await page.$('#ca-rc-tag')).tap();
    await sleep(300);
    const s = await state();
    console.log('after tail tap        ', JSON.stringify(s));
    console.log(s.cls.includes('ca-rc-tagon') && s.bg === 'rgb(201, 162, 39)' ? 'VERDICT: gold ON (pin passes)' : 'VERDICT: NOT GOLD (pin fails)');
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('DIAG FAIL', e); process.exit(1); });
