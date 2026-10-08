// Round-16 diag: does the month header wrap on narrow screens with the
// tag overlay on? Measure at several phone-class widths.
const puppeteer = require('puppeteer-core');
process.env.LD_LIBRARY_PATH = ['/tmp/chr-libs/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
const chromium = require('@sparticuz/chromium').default;
const BASE = 'http://127.0.0.1:8799';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const exe = await chromium.executablePath();
    const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args, headless: chromium.headless, defaultViewport: { width: 390, height: 844, hasTouch: true } });
    try {
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
        await page.evaluate(() => openRosterCalendar());
        await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden'), { timeout: 5000 });
        await sleep(600);
        for (const width of [414, 390, 375, 360, 320]) {
            await page.setViewport({ width, height: 844, hasTouch: true });
            await sleep(200);
            for (const on of [false, true]) {
                await page.evaluate((wantOn) => {
                    const g = document.getElementById('ca-rc-grid');
                    const isOn = g.classList.contains('rc-tags-on');
                    if (wantOn !== isOn) document.getElementById('ca-rc-tag').click();
                }, on);
                await sleep(300);
                const m = await page.evaluate(() => {
                    const h3 = document.getElementById('ca-rc-month');
                    const r = h3.getBoundingClientRect();
                    const row = h3.closest('.flex.items-center.justify-between');
                    const left = h3.closest('.flex.items-center');
                    const cs = getComputedStyle(h3);
                    return {
                        text: h3.textContent,
                        h: +r.height.toFixed(1),
                        w: +r.width.toFixed(1),
                        whiteSpace: cs.whiteSpace,
                        rowScroll: row ? row.scrollWidth : null,
                        rowClient: row ? row.clientWidth : null,
                        leftW: left ? +left.getBoundingClientRect().width.toFixed(1) : null,
                        rowH: row ? +row.getBoundingClientRect().height.toFixed(1) : null,
                    };
                });
                console.log(width + 'px', on ? 'ON ' : 'OFF', JSON.stringify(m));
            }
        }
    } catch (e) {
        console.log('DIAG ERROR:', e && e.message);
    } finally {
        await browser.close();
    }
})();
