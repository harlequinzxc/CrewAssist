// v1.46.6 diag: the direct-share round's timing proof. The owner's phone
// reports captures still slow; the rig quotes tap->PNG with the new 4MP
// area cap + 4090px height cap in place (same --disable-gpu rig class as
// the v1.46.4/v1.46.5 probes, so the numbers compare across rounds).
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
                localStorage.setItem('crewAssist.wnSeen', '1.46.6');
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
            showArchiveOverlay();
        });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await sleep(1400);
        // three timed takes of the tall earnings card (2025)
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => { window.__caLastShot = null; document.getElementById('ca-arch-cam').click(); });
            await sleep(500);
            const t0 = await page.evaluate(() => {
                window.__t0 = performance.now();
                Array.from(document.querySelectorAll('#ca-arch-sub-body .ca-cap-yearrow'))[1].click();
                return window.__t0;
            });
            await page.waitForFunction(() => !!window.__caLastShot, { timeout: 30000 });
            const r = await page.evaluate(async () => {
                const dt = performance.now() - window.__t0;
                const bmp = await createImageBitmap(window.__caLastShot.blob);
                const rect = { w: bmp.width, h: bmp.height, mp: +(bmp.width * bmp.height / 1e6).toFixed(2) };
                return { dt: Math.round(dt), size: window.__caLastShot.size, ...rect, dpr: window.devicePixelRatio || 1 };
            });
            console.log('take ' + (i + 1) + ': tap->PNG ' + r.dt + 'ms | ' + r.w + 'x' + r.h + ' (' + r.mp + 'MP, dpr ' + r.dpr + ') | ' + (r.size / 1024).toFixed(0) + 'KB');
        }
        // and the short passport hero for contrast (stays scale 2)
        console.log('done');
    } catch (e) { console.log('DIAG ERR', e && e.message); } finally { await browser.close(); }
})();
