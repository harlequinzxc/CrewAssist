// v1.45.34 diag: replay the smoke's 7c (changelog layer) + 7b (reduced
// motion) sequence and dump state at every step — the typing-bubble FAIL and
// the motion-pill tap timeout both fired after the new layer slotted in.
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
        // release the welcome chat like the smoke does
        await page.waitForFunction(() => { const b = document.getElementById('whatsnew-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 15000 });
        await page.evaluate(() => document.getElementById('whatsnew-close').click());
        await sleep(400);
        // catch a typing window mid-flight and run 7b inside it
        let caught = false;
        for (let i = 0; i < 300; i++) {
            await sleep(100);
            if (await page.evaluate(() => !!document.getElementById('typing-indicator'))) { caught = true; break; }
        }
        console.log('typing window caught:', caught, '| busy:', await page.evaluate(() => document.documentElement.classList.contains('chat-busy')));

        // --- 7: settings widths + close (as in the smoke) ---
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        await page.evaluate(() => closeSettings());
        await sleep(300);

        // --- 7c: the v1.45.34 changelog layer ---
        await page.evaluate(() => openChangelog());
        await page.waitForFunction(() => { const b = document.getElementById('ca-changelog-backdrop'); return b && !b.classList.contains('hidden'); }, { timeout: 5000 });
        console.log('7c chips:', await page.evaluate(() => [...document.querySelectorAll('#ca-cl-chips .ca-cl-chip')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('|')));
        await page.evaluate(() => document.getElementById('ca-changelog-close').click());
        await sleep(400);
        console.log('7c after close+400ms: backdrop hidden =', await page.evaluate(() => document.getElementById('ca-changelog-backdrop').classList.contains('hidden')), '| sheet translateY =', await page.evaluate(() => document.getElementById('ca-changelog-sheet').className.includes('translate-y-full')));

        // --- 7b: reduced motion ---
        console.log('7b ca-reduced before:', await page.evaluate(() => document.documentElement.classList.contains('ca-reduced')));
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.waitForFunction(() => document.documentElement.classList.contains('ca-reduced'), { timeout: 5000 });
        console.log('7b ca-reduced after emu: true');
        console.log('7b leftover typing-indicator at pin:', await page.evaluate(() => { showTypingIndicator(); return !!document.getElementById('typing-indicator'); }));
        await page.evaluate(() => openSettings());
        await page.waitForFunction(() => !document.getElementById('settings-backdrop').classList.contains('hidden'), { timeout: 5000 });
        await sleep(400);
        const tapInfo = await page.evaluate(() => {
            const p = document.getElementById('motion-pill-full');
            const r = p.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            return { rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, cx: +cx.toFixed(1), cy: +cy.toFixed(1), topEl: top ? top.id || top.tagName + '.' + top.className : null, isPill: top === p };
        });
        console.log('7b pill geometry + topmost:', JSON.stringify(tapInfo));
        await (await page.$('#motion-pill-full')).tap();
        await sleep(600);
        console.log('7b after tap: ca-reduced =', await page.evaluate(() => document.documentElement.classList.contains('ca-reduced')), '| motion =', await page.evaluate(() => localStorage.getItem('crewAssist.motion')), '| aria =', await page.evaluate(() => document.getElementById('motion-pill-full').getAttribute('aria-checked')));
    } catch (e) {
        console.log('DIAG ERROR:', e && e.message);
    } finally {
        await browser.close();
    }
})();
