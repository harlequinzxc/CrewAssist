// v1.47.1 diag: both cameras' timing + exact-dims proof on the hand-paint
// pattern. The passport hero carries its title band above the card; the
// earnings camera joins the same pattern over the FULL posed scroll. The
// rig quotes pick->PNG for both (same --disable-gpu rig class as the
// v1.46.4/5/6/v1.47.0 probes, so the numbers compare across rounds) and
// proves the dimensions: title band + card, exactly.
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
        // three timed takes of the All-Time hero (pick -> PNG), title band included
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
            const dw = Math.abs(r.w - Math.ceil(r.live.w)), dh = Math.abs(r.h - Math.ceil(r.live.h) - 34);
            console.log('passport take ' + (i + 1) + ': pick->PNG ' + r.dt + 'ms | ' + r.w + 'x' + r.h + ' vs live+band ' + r.live.w + 'x' + (r.live.h + 34) + ' (d' + dw + '/d' + dh + ', dpr ' + r.dpr + ') | ' + (r.size / 1024).toFixed(0) + 'KB | ' + r.name);
        }
        // close the records page + calendar, open the archive, and time the
        // EARNINGS camera on the same rig (2025, the taller card)
        await page.evaluate(() => { closeRcPod(); closeRosterCalendar(); });
        await sleep(700);
        await page.evaluate(() => { showArchiveOverlay(); });
        await page.waitForSelector('#ca-arch-backdrop:not(.hidden)', { timeout: 8000 });
        await sleep(1400);
        // v1.47.2: the fold probes ride the same builder wrapper — the
        // folded rows' clip verdict and the ink zone below the last head,
        // read straight off each take
        await page.evaluate(() => {
            window.__basc = buildArchShotCanvas;
            buildArchShotCanvas = function (el) {
                const foldRow = el.querySelector('.ca-arch-collapsed .ca-arch-row');
                const heads = Array.from(el.querySelectorAll('.ca-arch-group-head'));
                const elTop = el.getBoundingClientRect().top;
                window.__posedScrollH = el.scrollHeight;
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
        });
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => { window.__caLastShot = null; document.getElementById('ca-arch-cam').click(); });
            await sleep(500);
            await page.evaluate(() => {
                window.__t0 = performance.now();
                Array.from(document.querySelectorAll('#ca-arch-sub-body .ca-cap-yearrow'))[1].click();
            });
            await page.waitForFunction(() => !!window.__caLastShot, { timeout: 30000 });
            const r = await page.evaluate(async () => {
                const dt = performance.now() - window.__t0;
                const bmp = await createImageBitmap(window.__caLastShot.blob);
                const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
                const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
                const data = x.getImageData(0, 0, c.width, c.height).data;
                const bg = document.documentElement.classList.contains('dark') ? [6, 9, 17] : [247, 243, 236];
                // wing ink below the last record: the card's own footer
                // ("Showing earnings since...") is a short centered micro
                // line; a leaked folded row is a full-width band — route at
                // the left wing, amount + delete glyph at the right
                const zoneTop = Math.round(window.__posedClip.lastHeadBottom) + 34 + 8;
                let wingInk = 0;
                for (let y = zoneTop; y < c.height - 6; y++) {
                    for (let px = 2; px < c.width - 2; px++) {
                        if (px < Math.round(c.width * 0.2) || px > Math.round(c.width * 0.8)) {
                            const i = (y * c.width + px) * 4;
                            if (Math.abs(data[i] - bg[0]) > 40 || Math.abs(data[i + 1] - bg[1]) > 40 || Math.abs(data[i + 2] - bg[2]) > 40) wingInk++;
                        }
                    }
                }
                const pc = window.__posedClip;
                return { dt: Math.round(dt), size: window.__caLastShot.size, w: bmp.width, h: bmp.height, name: window.__caLastShot.name, wingInk: wingInk, walkRows: window.__posedWalkRows, clip: pc.folded + '/' + pc.laidOut + ' folded, rowClip ' + pc.foldedClip + ', headClip ' + pc.headClip };
            });
            console.log('earnings take ' + (i + 1) + ': pick->PNG ' + r.dt + 'ms | ' + r.w + 'x' + r.h + ' | ' + (r.size / 1024).toFixed(0) + 'KB | walk paints ' + r.walkRows + ' station rows | wing ink below last record: ' + r.wingInk + 'px | ' + r.clip + ' | ' + r.name);
        }
        console.log('done');
    } catch (e) { console.log('DIAG ERR', e && e.message); } finally { await browser.close(); }
})();
