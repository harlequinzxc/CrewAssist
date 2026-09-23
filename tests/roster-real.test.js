// Real-roster regression: every PDF in ../_inbox goes through the REAL
// pipeline — pdfjs-dist text extraction (same shape rosterReadPdf produces:
// {str, x, y, page}) into the booted app's rosterParse. These are the
// owner's actual Crew Roster Reports (2024–2026), committed as fixtures.
//
// New uploads default to "must parse fully clean": if a newly added roster
// fails here, either it shows a pattern the parser doesn't know (fix the
// parser) or it carries honest flags (record them in EXPECTED_FLAGS below).
// Honest flags are of two kinds: month-boundary trips, which complete once
// the neighbouring month is stitched in, and TVL positioning sectors, for
// which the roster prints no flight time at all.
const H = require('./_harness');
const { R, boot, APP } = H;
const fs = require('fs');
const path = require('path');

const EXPECTED_FLAGS = {
    'Feb 2025.pdf': ['does not return to Singapore before the roster ends'],
    'Mar 2025.pdf': ['starts outside Singapore (roster begins mid-trip)', 'does not return to Singapore before the roster ends'],
    'Apr 2025.pdf': ['starts outside Singapore (roster begins mid-trip)', 'some times could not be read'],
    'Jun 2025.pdf': ['some times could not be read'],
    'Aug 2024.pdf': ['does not return to Singapore before the roster ends'],
    'Sep 2024.pdf': ['starts outside Singapore (roster begins mid-trip)'],
    'Oct 2024.pdf': ['some times could not be read'],
    'Aug 2025.pdf': ['does not return to Singapore before the roster ends'],
    'Sep 2025.pdf': ['starts outside Singapore (roster begins mid-trip)', 'does not return to Singapore before the roster ends'],
    'Oct 2025.pdf': ['starts outside Singapore (roster begins mid-trip)'],
    'Dec 2025.pdf': ['does not return to Singapore before the roster ends'],
    'October 2026.pdf': ['does not return to Singapore before the roster ends'],
};

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const FULL = { January: '01', February: '02', March: '03', April: '04', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };
function expectedMonthLabel(f) {
    const m = /^([A-Za-z]+) (\d{4})\.pdf$/.exec(f);
    if (!m) return null;
    const mm = MONTHS[m[1]] || FULL[m[1]];
    return mm ? m[2] + '-' + mm : null;
}

(async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { w } = await boot(APP, {});
    R.eq(typeof w.rosterParse, 'function', 'the app boots with rosterParse global');

    async function extract(file) {
        const data = new Uint8Array(fs.readFileSync(file));
        const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
        const items = [];
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            tc.items.forEach(it => { if (it.str && it.str.trim()) items.push({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], page: p }); });
            await page.cleanup();
        }
        await doc.cleanup();
        return items;
    }

    const dir = path.resolve(__dirname, '../_inbox');
    const files = fs.readdirSync(dir).filter(f => /\.pdf$/i.test(f)).sort();
    R.ok(files.length >= 6, `roster fixtures present (${files.length} files)`);

    const singles = {};   // file -> { parsed, startsOutside, doesNotReturn, timesCount, threeCount }
    for (const f of files) {
        const items = await extract(path.join(dir, f));
        const r = w.rosterParse(items);
        const trips = r.trips || [];
        const flagged = trips.filter(t => !t.ok);
        R.ok(trips.length >= 1, `${f}: parses into trips`);
        R.eq(r.monthLabel, expectedMonthLabel(f), `${f}: month label matches the filename`);
        R.eq(r.flights.length, trips.reduce((n, t) => n + t.sectors.length, 0), `${f}: every flight belongs to a trip`);

        // no phantom sectors: the three-row duty echo (op row, empty row,
        // STA row) must never spawn a std-less, sta-less sector
        const phantoms = r.flights.filter(s => !s.std && !s.sta);
        R.eq(phantoms.length, 0, `${f}: no phantom sectors from empty echo rows`);

        const reasons = [...new Set(flagged.map(t => t.reason))].sort().join(';');
        const exp = (EXPECTED_FLAGS[f] || []).slice().sort().join(';');
        R.eq(reasons, exp, `${f}: flagged trips match the recorded expectations${EXPECTED_FLAGS[f] ? '' : ' (new rosters must parse fully clean)'}`);

        singles[f] = {
            parsed: r,
            startsOutside: reasons.indexOf('starts outside') !== -1,
            doesNotReturn: reasons.indexOf('does not return') !== -1,
            timesCount: flagged.filter(t => t.reason.indexOf('could not be read') !== -1).length,
            threeCount: flagged.filter(t => t.reason.indexOf('sectors (calculator supports') !== -1).length,
        };
    }

    // ---- stitching: consecutive months complete their boundary trips ----
    // A pair's stitched output may keep 'starts outside' only if the FIRST
    // file alone started mid-trip (the completing sector is a month earlier
    // still), and 'does not return' only if the SECOND file alone ended
    // mid-trip. Everything inner must resolve. TVL and 3-sector flags may
    // never increase.
    const order = files.slice().sort((a, b) => String(singles[a].parsed.monthLabel).localeCompare(String(singles[b].parsed.monthLabel)));
    for (let i = 0; i + 1 < order.length; i++) {
        const a = order[i], b = order[i + 1];
        const ma = String(singles[a].parsed.monthLabel), mb = String(singles[b].parsed.monthLabel);
        if (nextMonth(ma) !== mb) continue;   // not consecutive months
        const st = w.rosterParse(w.rosterStitchItems([
            await extract(path.join(dir, a)), await extract(path.join(dir, b))
        ]));
        const flagged = (st.trips || []).filter(t => !t.ok);
        const starts = flagged.some(t => t.reason.indexOf('starts outside') !== -1);
        const ends = flagged.some(t => t.reason.indexOf('does not return') !== -1);
        const times = flagged.filter(t => t.reason.indexOf('could not be read') !== -1).length;
        const three = flagged.filter(t => t.reason.indexOf('sectors (calculator supports') !== -1).length;
        R.ok(!starts || singles[a].startsOutside, `${a} + ${b}: stitching resolves the start boundary`);
        R.ok(!ends || singles[b].doesNotReturn, `${a} + ${b}: stitching resolves the end boundary`);
        R.ok(times <= singles[a].timesCount + singles[b].timesCount, `${a} + ${b}: stitching adds no unreadable times`);
        R.ok(three <= singles[a].threeCount + singles[b].threeCount, `${a} + ${b}: stitching adds no broken sector counts`);
    }

    // ---- deep real cases pinning the long-haul three-row duty echo ----
    if (singles['Feb 2025.pdf'] && singles['Mar 2025.pdf'] && singles['Apr 2025.pdf']) {
        const st = w.rosterParse(w.rosterStitchItems([
            await extract(path.join(dir, 'Feb 2025.pdf')),
            await extract(path.join(dir, 'Mar 2025.pdf')),
            await extract(path.join(dir, 'Apr 2025.pdf')),
        ]));
        const flagged = (st.trips || []).filter(t => !t.ok);
        R.eq(flagged.length, 1, 'Feb+Mar+Apr 2025 stitched: only the TVL trip stays flagged');
        R.ok(flagged[0] && flagged[0].reason.indexOf('could not be read') !== -1, 'Feb+Mar+Apr 2025 stitched: the remaining flag is the TVL flight time');
        const sfo = (st.trips || []).find(t => t.ok && t.sectors.some(s => s.dep === 'SFO' || s.arr === 'SFO'));
        R.ok(!!sfo, 'Feb+Mar+Apr 2025 stitched: the SFO round trip completes');
        const lhr = (st.trips || []).find(t => t.ok && t.sectors.some(s => s.dep === 'LHR' || s.arr === 'LHR'));
        R.ok(!!lhr, 'Feb+Mar+Apr 2025 stitched: the LHR round trip completes');
    }
    process.exit(R.done());
})().catch(e => { console.error(e); process.exit(1); });

function nextMonth(ym) {
    const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    return (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'));
}
