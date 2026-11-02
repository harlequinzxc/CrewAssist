// v1.47.0 diag: the passport repaint's timing + exact-dims proof. The
// owner scrapped both capture functions; this round the passport hero is
// hand-painted with the roster technique (no painter library). The rig
// quotes pick->PNG with the new flow in place (same --disable-gpu rig
// class as the v1.46.4/5/6 probes, so the numbers compare across rounds)
// and proves the capture's dimensions ARE the live hero card's — no
// injected header, no pills, no trim air.
const puppeteer = require('puppeteer-core');
process.env.LD_LIBRARY_PATH = ['/tmp/chr-libs/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
const chromium = require('@sparticuz/chromium').default;
const BASE = 'http://127.0.0.1:8799';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const exe = await chromium.executablePath();
    const browser = await puppeteer.launch({ executablePath: exe, args: chromium.args.concat(['--disable-gpu']), headless: chromium.headless, defaultViewport: { width: 390, height: 844, hasTouch: true } });
    try {
        const page = await browser.newPage();
        await page.emulateTimezone('Asia/Singapore');
        await page.evaluateOnNewDocument(() => {
            try {
                localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Smoke', gender: 'Male', rank: 'FS' }));
                localStorage.setItem('crewAssist.wnSeen', '1.47.0');
                localStorage.setItem('crewAssist.calcUi', 'manual');
            } catch (e) {}
        });
        await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('#chat-container', { timeout: 20000 });
        // seed the same two-year archive the smoke's camera section uses
        await page.evaluate(() => {
            localStorage.setItem('crewAssist.archive', JSON.stringify([
                { id: 'cam0', savedAt: '2025-06-15T10:00:00Z', monthKey: '2025-06', sectorDate: '2025-06-15', stationDisplay: 'SIN/BKK', amount: 120, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 120, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 120, sectors: [], stations: [] } },
                { id: 'cam4', savedAt: '2025-09-15T10:00:00Z', monthKey: '2025-09', sectorDate: '2025-09-15', stationDisplay: 'SIN/PNH', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } },
                { id: 'cam5', savedAt: '2025-11-20T10:00:00Z', monthKey: '2025-11', sectorDate: '2025-11-20', stationDisplay: 'SIN/CGK', amount: 150, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 150, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 150, sectors: [], stations: [] } },
                { id: 'cam1', savedAt: '2026-03-15T10:00:00Z', monthKey: '2026-03', sectorDate: '2026-03-15', stationDisplay: 'SIN/KUL', amount: 80, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 80, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 80, sectors: [], stations: [] } },
                { id: 'cam2', savedAt: '2026-06-15T10:00:00Z', monthKey: '2026-06', sectorDate: '2026-06-15', stationDisplay: 'SIN/DPS', amount: 120, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 120, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 120, sectors: [], stations: [] } },
                { id: 'cam3', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'SIN/HKT', amount: 100, flightType: 'Turnaround', detail: { v: 1, type: 'both', ifaTotal: 100, lmaTotal: 0, bonusCount: 0, bonusAmount: 0, grandTotal: 100, sectors: [], stations: [] } }
            ]));
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
            openRosterCalendar();
        });
        await page.waitForFunction(() => !document.getElementById('ca-roster-cal').classList.contains('hidden'), { timeout: 8000 });
        await sleep(1200);
        // the records page, then let the reels settle before timing
        await page.evaluate(() => { openRcPod(); });
        await page.waitForSelector('#ca-rc-pod-herowrap', { timeout: 8000 });
        await sleep(1600);
        // three timed takes of the All-Time hero (pick -> PNG)
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => { window.__caLastShot = null; document.getElementById('btn-rc-pod-cam').click(); });
            await sleep(500);
            await page.evaluate(() => {
                window.__t0 = performance.now();
                document.querySelector('#ca-rc-podcap-body .ca-cap-yearrow[data-yr="all"]').click();
            });
            await page.waitForFunction(() => !!window.__caLastShot, { timeout: 30000 });
            const r = await page.evaluate(async () => {
                const dt = performance.now() - window.__t0;
                const bmp = await createImageBitmap(window.__caLastShot.blob);
                const hero = document.getElementById('ca-rc-pod-herowrap').getBoundingClientRect();
                return {
                    dt: Math.round(dt), size: window.__caLastShot.size,
                    w: bmp.width, h: bmp.height,
                    live: { w: Math.round(hero.width), h: Math.round(hero.height) },
                    name: window.__caLastShot.name,
                    dpr: window.devicePixelRatio || 1
                };
            });
            const dw = Math.abs(r.w - Math.ceil(r.live.w)), dh = Math.abs(r.h - Math.ceil(r.live.h));
            console.log('take ' + (i + 1) + ': pick->PNG ' + r.dt + 'ms | ' + r.w + 'x' + r.h + ' vs live ' + r.live.w + 'x' + r.live.h + ' (d' + dw + '/d' + dh + ', dpr ' + r.dpr + ') | ' + (r.size / 1024).toFixed(0) + 'KB | ' + r.name);
        }
        console.log('done');
    } catch (e) { console.log('DIAG ERR', e && e.message); } finally { await browser.close(); }
})();
