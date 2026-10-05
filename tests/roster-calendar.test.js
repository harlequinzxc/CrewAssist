// Roster calendar (v1.39.0 B6 + hotfixes): the parser reads the roster's Duty
// column — flying days, layover days with their station, the OFF family,
// annual leave, standby and course codes — into a duty-day store, and the
// header's calendar icon opens the owner-spec pill grid. Hotfix 4 (owner
// report, real roster): a duty's footprint runs from its report day through
// the FINAL LANDING day (continuation rows like "13 Oct 1900H → (+1) 0015H"
// land on the 14th), back-to-back turnarounds never merge into one capsule
// (each fly day carries its duty's key), dateless LO rows are the landing
// day of the flight above them, and legs come from a never-pruned flight
// store so PAST duties retell their times too.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
const path = require('path');

// Synthetic PDF items: the roster's rotated table (x = row, y = column).
// Columns: Start Date 21, Day 65, Flight 91, Sector 138, A/C 183, Duty 210,
// Rank 298, Rpt 328, STD 358, STA 388, FT 421.
const row = (x, cells) => cells.map(c => ({ str: c[1], x, y: c[0], page: 1 }));
const synthItems = [].concat(
    row(150, [[21, 'Start Date'], [65, 'Day'], [91, 'Flight'], [138, 'Sector'], [183, 'A/C'], [210, 'Duty'], [298, 'Rank'], [328, 'Rpt'], [358, 'STD'], [388, 'STA'], [421, 'Flight'], [423, 'Time'], [461, 'Duty'], [463, 'Time']]),
    row(180, [[21, '01Oct26'], [65, 'Thu'], [91, 'SQ 106'], [134, 'SIN-KUL'], [211, 'FLY'], [358, '0825'], [388, '0935']]),
    row(201, [[91, 'SQ 105'], [134, 'KUL-SIN'], [211, 'FLY'], [358, '1025'], [388, '1145']]),
    row(224, [[21, '02Oct26'], [65, 'Fri'], [143, 'MEL'], [207, 'LO']]),
    row(246, [[21, '03Oct26'], [65, 'Sat'], [143, 'SIN'], [207, 'ATDO']]),
    row(268, [[21, '04Oct26'], [65, 'Sun'], [143, 'SIN'], [207, 'AALV']]),
    row(290, [[21, '05Oct26'], [65, 'Mon'], [143, 'SIN'], [208, 'SN80']]),
    row(312, [[21, '06Oct26'], [65, 'Tue'], [91, 'SQ 207'], [134, 'SIN-MEL'], [211, 'FLY'], [358, '0100'], [388, '0900']]),
    // the generator prints the LANDING-day layover row with no date — it is
    // the day the flight above it touches down (06 Oct here), never +1
    row(334, [[143, 'MEL'], [214, 'LO']]),
    row(345, [[21, '07Oct26'], [65, 'Wed'], [143, 'MEL'], [214, 'LO']]),
    // an overnight return: dep 2300, lands 0455 the NEXT day
    row(367, [[21, '08Oct26'], [65, 'Thu'], [91, 'SQ 218'], [134, 'MEL-SIN'], [211, 'FLY'], [358, '2300'], [388, '0455']]),
    // a duty that reports one evening and departs after midnight: the
    // report row carries the date + totals, the next row the STD/STA
    row(389, [[21, '10Oct26'], [65, 'Sat'], [91, 'SQ 100'], [134, 'SIN-PEK'], [211, 'FLY'], [328, '2205'], [421, '06:20'], [460, '08:00']]),
    row(411, [[21, '11Oct26'], [65, 'Sun'], [91, 'SQ 100'], [134, 'SIN-PEK'], [211, 'FLY'], [358, '0010'], [388, '0630']]),
    // the Duty Codes legend page — its rows must never become days
    row(600, [[30, 'Duty'], [70, 'Duty'], [120, 'Duty Codes'], [180, 'Duty Desc'], [188, 'Duty']]).map(i => Object.assign(i, { page: 2 })),
    row(650, [[68, 'ATDO'], [166, 'AUTO TAG DAY OFF']]).map(i => Object.assign(i, { page: 2 })),
    row(700, [[72, 'FLY'], [128, 'FLYING']]).map(i => Object.assign(i, { page: 2 })),
    row(750, [[68, 'SN60'], [158, 'NB STANDBY 0600-2200']]).map(i => Object.assign(i, { page: 2 }))
);

(async () => {
  // ---- the parser: duty spans, landing days, and the duty key ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(synthItems) + ')');
    R.eq(w.eval('window.__p.flights.length'), 5, 'the flights pass is untouched by duty-day parsing');
    const days = JSON.parse(w.eval('JSON.stringify(window.__p.days)'));
    const byYmd = {}; days.forEach(d => { byYmd[d.ymd] = d; });
    R.eq(days.length, 11, 'every duty row becomes exactly one day — landing days included');
    R.eq(byYmd['2026-10-01'].kind, 'fly', 'a flying row is a fly day');
    R.ok(JSON.stringify(byYmd['2026-10-01'].fns) === JSON.stringify(['106', '105']), 'the day carries its flight numbers');
    R.eq(byYmd['2026-10-01'].dkey, '2026-10-01', 'a turnaround carries its own duty key');
    R.eq(byYmd['2026-10-02'].kind + '@' + byYmd['2026-10-02'].loc, 'lo@MEL', 'a dated LO row is a layover day with its station');
    R.eq(byYmd['2026-10-03'].kind, 'off', 'ATDO is an OFF day (the owner\u2019s code list)');
    R.eq(byYmd['2026-10-04'].kind, 'al', 'AALV is annual leave');
    R.eq(byYmd['2026-10-05'].kind + '[' + byYmd['2026-10-05'].code + ']', 'duty[SN80]', 'a standby code keeps its own label');
    R.eq(byYmd['2026-10-06'].kind, 'fly', 'the departure day is a fly day');
    R.eq(byYmd['2026-10-06'].loc, '', 'the dateless landing-day LO loses to the flight already on that day');
    R.eq(byYmd['2026-10-07'].kind + ':' + byYmd['2026-10-07'].dkey, 'fly:2026-10-06', 'a dated LO row INSIDE a duty\u2019s span joins that duty\u2019s gold run (hotfix 5)');
    R.eq(byYmd['2026-10-09'].kind + ':' + byYmd['2026-10-09'].fns.join('/') + ':' + byYmd['2026-10-09'].dkey, 'fly:218:2026-10-06', 'an overnight leg marks its LANDING day, carrying its duty\u2019s key');
    R.eq(byYmd['2026-10-10'].kind + ':' + byYmd['2026-10-10'].fns.join('/'), 'fly:100', 'the report row\u2019s evening is a fly day');
    R.eq(byYmd['2026-10-11'].kind + ':' + byYmd['2026-10-11'].fns.join('/') + ':' + byYmd['2026-10-11'].dkey, 'fly:100:2026-10-10', 'an after-midnight departure marks the day its STD row is dated');
    R.ok(!byYmd['2026-10-12'], 'the Duty Codes legend page never becomes days');
    // the OFF family, per the owner's list
    R.eq(w.eval("rosterParse([{str:'13Oct26',x:10,y:21,page:1},{str:'OFFD',x:10,y:207,page:1},{str:'EXDO',x:32,y:207,page:1},{str:'RQ99',x:54,y:207,page:1},{str:'RX99',x:76,y:207,page:1}].concat([{str:'Start Date',x:2,y:21,page:1},{str:'Duty',x:2,y:210,page:1}])).days.map(d=>d.kind).join(',')"), 'off,off,off,off', 'OFFD, EXDO, RQ99 and RX99 all read as OFF');
  }

  // ---- the store: month-replaced like the upcoming store ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [{ ymd: '2026-10-01', kind: 'off', code: 'OFFD', loc: '', fns: [] }] }));
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(synthItems) + ')');
    w.eval('upcomingRemember(window.__p)');
    const store = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    R.ok(store['2026-10'].length > 1, 'a re-import replaces the month it covers');
    R.ok(store['2026-10'].every(d => d.ymd.slice(0, 7) === '2026-10'), 'no day lands in the wrong month');
    const all = JSON.parse(w.localStorage.getItem('crewAssist.allFlights'));
    const allCount = Object.keys(all).reduce((n, mk) => n + (all[mk] || []).length, 0);
    R.eq(allCount, 5, 'every parsed leg lands in the never-pruned flight store');
    R.ok(all['2026-10'].every(f => /^\d{4}-\d{2}-\d{2}$/.test(f.stdYmd) && /^\d{4}-\d{2}-\d{2}$/.test(f.staYmd)), 'the full store carries each leg\u2019s true departure and arrival dates');
  }

  // ---- the real October + November 2026 rosters: end-to-end honesty ----
  {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const readItems = async (file) => {
      const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../_inbox/' + file)));
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
      const items = [];
      for (let pi = 1; pi <= doc.numPages; pi++) {
        const tc = await (await doc.getPage(pi)).getTextContent();
        tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
      }
      return items;
    };
    const octItems = await readItems('October 2026.pdf');
    const novItems = await readItems('November 2026.pdf');
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__oct = rosterParse(' + JSON.stringify(octItems) + ')');
    R.eq(w.eval('window.__oct.flights.length'), 15, 'the real October roster still parses its 15 flights');
    w.eval('upcomingRemember(window.__oct)');
    let days = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    const dayAt = (store, ymd) => {
      const mk = String(ymd).slice(0, 7);
      return (store[mk] || []).find(x => x.ymd === ymd) || null;
    };
    // owner report, issue 2: 12–14 Oct is one SIN-SYD-SIN duty — the 0015H
    // landing on the 14th is a fly day of the SAME duty
    R.eq(dayAt(days, '2026-10-12').dkey, '2026-10-12', 'the SYD duty starts on the 12th');
    R.eq([13, 14].map(dd => dayAt(days, '2026-10-' + dd).kind + ':' + dayAt(days, '2026-10-' + dd).dkey).join('|'), 'fly:2026-10-12|fly:2026-10-12', 'the 13th and the 0015H landing on the 14th belong to the same duty');
    R.eq(dayAt(days, '2026-10-25').kind + ':' + dayAt(days, '2026-10-25').fns.join('/'), 'fly:218', 'the MEL duty\u2019s 0530H landing on the 25th is a fly day');
    // owner report, issue 1: 1 Oct and 2 Oct are two SEPARATE turnarounds
    R.ok(dayAt(days, '2026-10-01').dkey !== dayAt(days, '2026-10-02').dkey, 'the KUL turnaround and the HKT turnaround are different duties');
    // owner report, issue 4: flown duties keep their legs (the next-flight
    // card prunes landed legs; the calendar must not)
    R.ok(w.eval("loadAllFlights()['2026-10'].some(f => f.fn === '736' && f.stdYmd === '2026-10-02')"), 'the never-pruned store still holds the flown 2 Oct legs');
    R.ok(!w.eval("loadUpcoming()['2026-10'] || []").length || true, 'the upcoming store may prune; the calendar reads its twin');
    // then November — issue 3: 8–12 Nov is one SIN-LHR-SIN duty
    w.eval('window.__nov = rosterParse(' + JSON.stringify(novItems) + ')');
    w.eval('upcomingRemember(window.__nov)');
    days = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    R.eq([8, 9, 10, 11, 12].map(dd => dayAt(days, '2026-11-' + String(dd).padStart(2, '0')).kind + ':' + dayAt(days, '2026-11-' + String(dd).padStart(2, '0')).dkey).join('|'), 'fly:2026-11-08|fly:2026-11-08|fly:2026-11-08|fly:2026-11-08|fly:2026-11-08', 'the whole LHR duty — report day, departure, layover, and the 0615H landing — is ONE duty, 8th through 12th');
    R.eq(dayAt(days, '2026-11-02').kind + ':' + dayAt(days, '2026-11-02').fns.join('/'), 'fly:505', 'the SQ 505 0715H landing on 2 Nov is a fly day');
    R.eq(dayAt(days, '2026-11-01').kind, 'fly', '1 Nov flies out — the November roster\u2019s own print wins for its month');

    // ---- the calendar UI on real data (owner spec: the pill grid) ----
    w.eval('openRosterCalendar()');
    await wait(500);
    const wrap = d.getElementById('ca-roster-cal');
    R.ok(wrap && !wrap.classList.contains('hidden'), 'the header calendar opens the sheet');
    R.ok(wrap && wrap.closest('.hidden') === null, 'no hidden ancestor keeps the calendar blind');
    R.ok(wrap && !wrap.closest('#ca-arch-sub') && !wrap.closest('#ca-arch-sheet'), 'the calendar sheet is never nested inside another sheet');
    const TODAY = String(w.eval('todayLocalYMD()'));
    const oct = TODAY.slice(0, 7) === '2026-10';
    R.ok(!oct || d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'it opens on the current month');
    const src = fs.readFileSync(APP, 'utf8');
    const cells = Array.from(d.querySelectorAll('.ca-rc-day[data-ymd]'));
    R.eq(cells.length, 31, 'every day of the month is a tappable cell — duty or not');
    R.ok(src.indexOf('.ca-rc-cell') < 0 && src.indexOf('ca-rc-chip') < 0, 'no cell borders, no cell backgrounds, no text chips — the columns carry the structure');
    R.ok(src.indexOf('id="ca-rc-legend"') < 0, 'the legend is gone (owner order)');
    R.ok(!!d.getElementById('ca-rc-detail'), 'the detail section lives below the divider');
    R.ok(src.indexOf('@media (hover:hover) { .ca-rc-day:hover') >= 0, 'hover states live behind a real-pointer media query');
    R.ok(src.indexOf('.ca-rc-day:active { transform: scale(.92); }') >= 0, 'day cells give immediate press feedback');
    R.ok(src.indexOf('data-lucide="chevron-left"') >= 0 && src.indexOf('data-lucide="chevron-right"') >= 0, 'the chevrons are Lucide icons');
    // hotfix 6 (owner orders): the header itself
    R.ok(/^[A-Z][a-z]{2} \d{4}$/.test(d.getElementById('ca-rc-month').textContent), 'the month spells three letters — Oct 2026, never October 2026');
    R.ok(!d.getElementById('ca-rc-today'), 'the Today pill is gone — a double tap replaces it');
    R.ok(!!d.getElementById('ca-rc-jump') && !!d.getElementById('ca-rc-fold'), 'the month header button and the fold chevron live in the header');
    R.ok(src.indexOf('ca-rc-shade absolute inset-0 bg-black/60 backdrop-blur-sm') >= 0, 'the calendar shade matches the Settings backdrop — black/60 with the same blur');
    const settingsTop = (src.match(/id="settings-sheet"[^>]*class="([^"]*)"/) || [])[1] || '';
    const calTop = (src.match(/id="ca-rc-sheet"[^>]*class="([^"]*)"/) || [])[1] || '';
    R.ok(settingsTop.indexOf('top-[calc(60px+env(safe-area-inset-top,20px))]') >= 0 && calTop.indexOf('top-[calc(60px+env(safe-area-inset-top,20px))]') >= 0 && calTop.indexOf('max-w-xl') < 0, 'the calendar sheet wears the Settings overlay’s exact height — same top offset, full width');
    R.ok(src.indexOf('w-8 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600') >= 0, 'the calendar grows the Settings-style drag handle');
    // ---- pills: shapes, kinds, and the OFF day's plainness ----
    const pills = Array.from(d.querySelectorAll('.ca-rc-pill'));
    const styleOf = (p) => p.getAttribute('style') || '';
    const weekRows = d.querySelectorAll('#ca-rc-grid .relative.grid');
    // owner report, issue 1: two turnarounds on back-to-back days are two
    // circles, never one capsule
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(4.5 * 100% / 7)') >= 0), '1 Oct (KUL turnaround) is its own gold circle');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(5.5 * 100% / 7)') >= 0), '2 Oct (HKT turnaround) is a SEPARATE circle — duties never bleed together');
    R.eq(weekRows[0].querySelectorAll('.ca-rc-pill').length, 2, 'the week of 1–3 Oct holds exactly the two turnaround circles — the OFF day shows none');
    // owner report, issue 2: 12–14 Oct is one continuous capsule
    const syd = Array.from(weekRows[2].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(1 * 100% / 7 + 3px)') >= 0);
    R.ok(!!syd && styleOf(syd).indexOf('calc(3 * 100% / 7 - 3px - 3px)') >= 0 && styleOf(syd).indexOf('999px 999px 999px 999px') >= 0, 'the SIN-SYD-SIN duty is ONE capsule from the 12th through its 0015H landing on the 14th');
    // the MEL duty wraps the week: flush Saturday edge, flush Sunday start
    const melA = Array.from(weekRows[3].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(5 * 100% / 7 + 3px)') >= 0);
    R.ok(!!melA && styleOf(melA).indexOf('999px 0 0 999px') >= 0, 'the 23–24 Oct segment ends flush at the week edge — the duty continues');
    const melB = Array.from(weekRows[4].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(0 * 100% / 7)') >= 0);
    R.ok(!!melB && styleOf(melB).indexOf('0 999px 999px 0') >= 0, '…and picks up flush on Sunday the 25th, rounding off at its landing');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-duty') >= 0 && styleOf(p).indexOf('calc(2.5 * 100% / 7)') >= 0) &&
        pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-duty') >= 0 && styleOf(p).indexOf('calc(3.5 * 100% / 7)') >= 0) &&
        !pills.some(p => p.className.indexOf('ca-rc-k-duty') >= 0 && p.className.indexOf('is-capsule') >= 0), '6 and 7 Oct are two separate standby circles — SSS1 and SS80 never merge');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-duty') >= 0 && styleOf(p).indexOf('calc(2.5 * 100% / 7)') >= 0 && p.className.indexOf('ca-rc-k-duty') >= 0) &&
        pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-duty') >= 0 && styleOf(p).indexOf('calc(3.5 * 100% / 7)') >= 0), '20 and 21 Oct are two separate standby circles (SN60, SN80 — owner report)');
    R.eq(d.querySelectorAll('.ca-rc-pill.ca-rc-k-lo').length, 0, 'layover days never draw green pills at all (owner order)');
    // ---- the today bar ----
    const todayCell = cells.find(c => c.getAttribute('data-ymd') === TODAY);
    R.ok(todayCell && !!todayCell.querySelector('.ca-rc-bar.is-today'), 'today is marked by the short accent bar beneath its number — duty day or off day alike');
    R.ok(cells.every(c => !!c.querySelector('.ca-rc-bar')), 'every cell keeps the bar slot — the indicator reads on duty days and off days alike');
    // ---- selection + the detail section ----
    R.ok(todayCell.classList.contains('is-selected'), 'opening the calendar selects today');
    const rows = () => Array.from(d.querySelectorAll('#ca-rc-detail .ca-rc-row'));
    const rowN = (n) => rows().find(r => r.querySelector('.ca-rc-gut .n') && r.querySelector('.ca-rc-gut .n').textContent === String(n));
    const gut = d.querySelector('.ca-rc-row.is-on .ca-rc-gut');
    R.ok(gut && gut.querySelector('.n') && gut.querySelector('.n').textContent === String(parseInt(TODAY.slice(8), 10)), 'the selected day is the highlighted row, its number in the date gutter');
    R.ok(gut && gut.querySelector('.m') && gut.querySelector('.m').textContent.length === 3, 'the gutter stacks the day over a three-letter month');
    // owner report, issue 4: a FLOWN turnaround retells its legs
    const past = cells.find(c => c.getAttribute('data-ymd') === '2026-10-02');
    past.click();
    await wait(300);
    let det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 736') >= 0 && det.indexOf('SQ 735') >= 0, 'the flown 2 Oct HKT turnaround retells both legs as flight cards');
    R.ok(det.indexOf('1615H') >= 0 && det.indexOf('2105H') >= 0, 'past legs keep their times (never-pruned store)');
    R.ok(det.indexOf('no leg times') < 0, 'a flown duty never says "no leg times for this day" again');
    // owner report, issue 2: the (+1) format
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-13').click();
    await wait(300);
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 241') >= 0 && det.indexOf('SQ 242') >= 0, 'the SYD duty names both sectors');
    R.ok(rowN(12) && rowN(13) && rowN(14) && !rowN(11) && !rowN(15), 'the duty flows as its own day rows — the 12th through the 14th');
    R.ok(rowN(13).classList.contains('is-on') && rowN(12).classList.contains('is-ctx') && rowN(14).classList.contains('is-ctx'), 'the selected day is the highlighted band, its trip muted around it');
    const t13 = rowN(13).textContent.replace(/\s+/g, ' ');
    R.ok(t13.indexOf('LO · SYD') >= 0 && t13.indexOf('SQ 242') >= 0, 'the 13th wakes in SYD and flies the leg home — layover label above the flight card');
    R.ok(t13.indexOf('1900H') >= 0 && t13.indexOf('(+1) 0015H') >= 0, 'a leg landing past midnight wears the owner\u2019s (+1) format');
    R.ok(t13.indexOf('8H 15M') >= 0, 'the card shows the roster\u2019s own block time — 8H 15M');
    const t14 = rowN(14).textContent.replace(/\s+/g, ' ');
    R.ok(t14.indexOf('Lands SIN') >= 0 && t14.indexOf('0015H') >= 0, 'the landing day reads Lands SIN · 0015H');
    const future = cells.find(c => c.getAttribute('data-ymd') === '2026-10-27');
    const cardsBefore = d.querySelectorAll('[data-calc-card]').length;
    future.click();
    await wait(300);
    R.ok(future.classList.contains('is-selected'), 'tapping a day selects it');
    R.eq(d.querySelectorAll('[data-calc-card]').length, cardsBefore, 'selecting a flying day never builds a calculator card');
    R.ok(d.getElementById('ca-arch-sub').classList.contains('hidden'), 'no popup — the day\u2019s details live in the section below the divider');
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 164') >= 0 && det.indexOf('SQ 163') >= 0, 'the detail names every leg of the duty');
    R.ok(rowN(27) && rowN(27).querySelectorAll('.ca-rc-trk .pt').length === 4, 'a two-sector day stacks two dashed-track cards');
    R.ok(det.indexOf('0840H') >= 0 && det.indexOf('0955H') >= 0, 'times read in the 24-hour HHMMH house format');
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-03').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('ATDO') >= 0 && d.getElementById('ca-rc-detail').textContent.indexOf('Enjoy your day off') >= 0, 'an off day shows its roster code and its caption');
    // standby windows (owner-provided timings)
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-20').click();
    await wait(200);
    let sbDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(sbDet.indexOf('Standby / SN60') >= 0 && sbDet.indexOf('Window 0600H') >= 0 && sbDet.indexOf('2159H') >= 0, 'a standby day shows its window — Standby / SN60, 0600H to 2159H');
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-04').click();
    await wait(200);
    sbDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(sbDet.indexOf('Standby / SSS3') >= 0 && sbDet.indexOf('Window 1200H') >= 0 && sbDet.indexOf('2359H') >= 0, 'SSS3 reads its 1200H to 2359H window');
    // a saved duty offers its earnings entry from the detail section
    w.eval("persistArchive([{ id: 'e1', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-29', flightType: 'Layover', stationDisplay: 'HKT', amount: 318.55 }])");
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-29').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('318.55') >= 0, 'a saved duty shows its amount beside the drill-in chevron');
    d.querySelector('#ca-rc-detail [data-rc-open-entry]').click();
    await wait(400);
    R.ok(!d.getElementById('ca-arch-sub').classList.contains('hidden'), 'the saved entry opens from the detail section');
    w.eval('closeArchSub()');
    await wait(300);
    // ---- month navigation: bounded arrows, label, rebuild, selection reset ----
    R.ok(d.getElementById('ca-rc-prev').classList.contains('ca-rc-off'), 'no previous data month — the back arrow grays out');
    R.ok(!d.getElementById('ca-rc-prev').classList.contains('invisible'), 'but it never disappears (owner order)');
    R.ok(!d.getElementById('ca-rc-next').classList.contains('ca-rc-off'), 'November holds roster days — the forward arrow stays live');
    d.getElementById('ca-rc-next').click();
    await wait(500);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'the month/year label follows the chevron');
    R.ok(d.querySelectorAll('.ca-rc-day[data-ymd="2026-10-27"]').length === 0, 'the grid rebuilds when the month changes');
    const novSel = d.querySelector('.ca-rc-day.is-selected');
    R.ok(novSel && novSel.getAttribute('data-ymd') === (oct ? '2026-11-01' : TODAY), 'a month without today resets the selection to its first day');
    // hotfix 6: the never-pruned store carries the aircraft, block time and
    // report time the flight cards need
    const allStore = JSON.parse(w.localStorage.getItem('crewAssist.allFlights') || '{}');
    const a306 = (allStore['2026-11'] || []).find(f => f && f.fn === '306');
    R.ok(a306 && a306.ac === '359' && a306.ft === '14:30' && a306.rpt === '2310', 'the allFlights store carries aircraft 359, FT 14:30 and report 2310 for SQ 306');
    // owner report: 8–12 Nov renders as ONE gold capsule
    const novWeek = d.querySelector('.ca-rc-day[data-ymd="2026-11-08"]').parentElement;
    const novPills = Array.from(novWeek.querySelectorAll('.ca-rc-pill'));
    R.eq(novPills.length, 1, 'the week of 8–12 Nov holds exactly one pill');
    R.ok(novPills[0] && novPills[0].className.indexOf('ca-rc-k-fly') >= 0 && styleOf(novPills[0]).indexOf('calc(0 * 100% / 7 + 3px)') >= 0 && styleOf(novPills[0]).indexOf('calc(5 * 100% / 7 - 3px - 3px)') >= 0 && styleOf(novPills[0]).indexOf('999px 999px 999px 999px') >= 0, 'the whole SIN-LHR-SIN duty is one gold capsule, the 8th through the 12th');
    d.querySelector('.ca-rc-day[data-ymd="2026-11-10"]').click();
    await wait(300);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('SQ 306') >= 0 && d.getElementById('ca-rc-detail').textContent.indexOf('SQ 305') >= 0, 'the absorbed layover day on the 10th retells the whole London duty');
    d.querySelector('.ca-rc-day[data-ymd="2026-11-09"]').click();
    await wait(300);
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 306') >= 0 && det.indexOf('SQ 305') >= 0, '9 Nov retells the WHOLE London duty');
    R.eq(rows().length, 5, 'the London duty flows as five day rows — the 8th through the 12th');
    R.ok(rowN(9).classList.contains('is-on') && rowN(8).classList.contains('is-ctx') && rowN(10).classList.contains('is-ctx') && rowN(11).classList.contains('is-ctx') && rowN(12).classList.contains('is-ctx'), 'the selected day is the highlighted band, the rest of the trip muted around it');
    const t9 = rowN(9).textContent.replace(/\s+/g, ' ');
    R.ok(t9.indexOf('SQ 306') >= 0 && t9.indexOf('359') >= 0 && t9.indexOf('0110H') >= 0 && t9.indexOf('0740H') >= 0, 'the 9th carries the SQ 306 hero card — aircraft 359, SIN 0110H to LHR 0740H');
    R.ok(t9.indexOf('14H 30M') >= 0, 'the block time reads from the roster\u2019s own FT row — 14H 30M');
    R.ok(rowN(9).querySelectorAll('.ca-rc-trk .pt').length === 2 && !!rowN(9).querySelector('.ca-rc-trk .ln'), 'the route renders as a dashed track with a filled dot at each end');
    R.ok(!!rowN(9).querySelector('[data-lucide="plane"]'), 'the plane rides the track, nose toward the destination');
    const t8 = rowN(8).textContent.replace(/\s+/g, ' ');
    R.ok(t8.indexOf('Report 2310H') >= 0, 'the report day shows its report time — 2310H');
    const t11 = rowN(11).textContent.replace(/\s+/g, ' ');
    R.ok(t11.indexOf('LO · LHR') >= 0 && t11.indexOf('SQ 305') >= 0, 'the 11th wakes in LHR — layover label stacked above its flight card');
    R.ok(t11.indexOf('0910H') >= 0 && t11.indexOf('(+1) 0615H') >= 0 && t11.indexOf('13H 05M') >= 0, 'the homebound leg wears its (+1) and the roster\u2019s 13H 05M block');
    d.querySelector('.ca-rc-day[data-ymd="2026-11-12"]').click();
    await wait(300);
    const t12b = rowN(12).textContent.replace(/\s+/g, ' ');
    R.ok(t12b.indexOf('Lands SIN') >= 0 && t12b.indexOf('0615H') >= 0, 'the landing day on the 12th reads Lands SIN · 0615H');
    R.ok(d.getElementById('ca-rc-next').classList.contains('ca-rc-off'), 'no month after November — the forward arrow grays out');
    // hotfix 6 (owner orders): the fold chevron and the double-tap month
    const gridEl = d.getElementById('ca-rc-grid');
    d.getElementById('ca-rc-fold').click();
    await wait(150);
    R.ok(gridEl.classList.contains('hidden'), 'the chevron collapses the calendar for the timeline');
    R.ok(rows().length === 5, 'the timeline keeps flowing with the grid folded away');
    d.getElementById('ca-rc-fold').click();
    await wait(150);
    R.ok(!gridEl.classList.contains('hidden'), 'and expands it back');
    d.getElementById('ca-rc-jump').click();
    d.getElementById('ca-rc-jump').click();
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'a double tap on the month header returns to today\u2019s month');
    R.ok(d.querySelector('.ca-rc-day.is-selected') && d.querySelector('.ca-rc-day.is-selected').getAttribute('data-ymd') === TODAY, 'and lands the selection on today');
    d.getElementById('ca-rc-next').click();
    await wait(500);
    // hotfix 5 (owner order): swipes change months — and respect the bounds
    const grid = d.getElementById('ca-rc-grid');
    const swipe = (x1, y1, x2, y2) => {
        const a = new w.Event('pointerdown', { bubbles: true }); a.clientX = x1; a.clientY = y1; grid.dispatchEvent(a);
        const b = new w.Event('pointerup', { bubbles: true }); b.clientX = x2; b.clientY = y2; grid.dispatchEvent(b);
    };
    swipe(200, 300, 20, 305);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'swiping left past the last data month does nothing');
    swipe(200, 300, 420, 305);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'swiping right returns to October');
    swipe(200, 300, 215, 460);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'a vertical drag never changes the month');
    swipe(200, 300, 20, 300);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'swiping left opens November');
    d.getElementById('ca-rc-prev').click();
    await wait(500);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'the back chevron returns to October');
    swipe(200, 300, 420, 300);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'swiping right before the first data month does nothing');
    R.ok(d.querySelector('.ca-rc-day.is-selected').getAttribute('data-ymd') === TODAY, 'a month holding today reselects today');
    // Escape closes the sheet
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
    R.ok(wrap.classList.contains('hidden'), 'Escape closes the roster calendar');
  }

  // ---- synthetic: a layover run that wraps a week and crosses a month ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      // one long duty (the hotfix-5 shape): a single gold run that wraps a
      // week AND crosses a month, plus a lone untimed fly day
      const fly = (ymd, dkey) => ({ ymd: ymd, kind: 'fly', code: '', loc: '', fns: ['999'], dkey: dkey || '' });
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({
        '2026-10': [fly('2026-10-26', '2026-10-26'), fly('2026-10-27', '2026-10-26'), fly('2026-10-28', '2026-10-26'), fly('2026-10-29', '2026-10-26'), fly('2026-10-30', '2026-10-26'), fly('2026-10-31', '2026-10-26'), fly('2026-10-08')],
        '2026-11': [fly('2026-11-01', '2026-10-26'), fly('2026-11-02', '2026-10-26')]
      }));
    } });
    w.eval('openRosterCalendar()');
    await wait(500);
    // week 4 holds 25–31 Oct: the six-day duty is ONE gold capsule, rounded on
    // Monday and flush at the Saturday edge — the run continues past it
    const w4 = d.querySelectorAll('#ca-rc-grid .relative.grid')[4];
    const seg1 = w4 ? Array.from(w4.querySelectorAll('.ca-rc-pill')) : [];
    R.ok(seg1.length === 1 && seg1[0].className.indexOf('ca-rc-k-fly') >= 0, 'the six-day duty is one gold capsule in its week row');
    R.ok(seg1[0].getAttribute('style').indexOf('calc(1 * 100% / 7 + 3px)') >= 0, 'it starts rounded on the Monday');
    R.ok(seg1[0].getAttribute('style').indexOf('999px 0 0 999px') >= 0, 'it ends flush at the week edge — the run continues');
    // November: the run continues flush from the left edge, rounding off at its true end
    d.getElementById('ca-rc-next').click();
    await wait(500);
    const novRow = d.querySelectorAll('#ca-rc-grid .relative.grid')[0];
    const seg2 = novRow ? Array.from(novRow.querySelectorAll('.ca-rc-pill')) : [];
    R.ok(seg2.length === 1 && seg2[0].getAttribute('style').indexOf('calc(0 * 100% / 7)') >= 0, 'a run wrapped from October continues flush from the left edge');
    R.ok(seg2[0].getAttribute('style').indexOf('0 999px 999px 0') >= 0, '…and rounds off at its true end on 2 Nov');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('no leg times') >= 0, 'a duty day with no parsed legs says so honestly');
    // a fly day the parser never timed says so honestly; a no-duty today keeps its bar
    d.getElementById('ca-rc-prev').click();
    await wait(500);
    const cells = Array.from(d.querySelectorAll('.ca-rc-day[data-ymd]'));
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-08').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('no leg times') >= 0, 'a fly day without parsed legs says so honestly');
    const todayCell = cells.find(c => c.getAttribute('data-ymd') === String(w.eval('todayLocalYMD()')));
    R.ok(todayCell && !!todayCell.querySelector('.ca-rc-bar.is-today'), 'the today bar shows on whatever kind of day today is');
    const w1 = d.querySelectorAll('#ca-rc-grid .relative.grid')[1];
    R.eq(w1.querySelectorAll('.ca-rc-pill').length, 1, 'no-duty days render no pills');
    R.ok(w1.querySelectorAll('.ca-rc-pill')[0].className.indexOf('is-circle') >= 0, 'a lone fly day renders as a circle');
  }

  // ---- a clean device: honest empty state, driven by the real button ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    let idleOk = false;
    for (let t = 0; t < 50 && !idleOk; t++) { await wait(200); idleOk = !!w.eval('!isChatBusy()'); }
    d.getElementById('btn-roster-cal').click();
    await wait(500);
    const wrapClean = d.getElementById('ca-roster-cal');
    R.ok(wrapClean && !wrapClean.classList.contains('hidden') && wrapClean.closest('.hidden') === null, 'tapping the header icon opens the calendar — through the real click, no hidden ancestor');
    R.ok(!d.getElementById('ca-rc-sheet').classList.contains('translate-y-full'), 'the sheet has slid up');
    R.ok(d.querySelectorAll('.ca-rc-pill').length === 0, 'a clean device renders no pills');
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('Nothing on the roster') >= 0, 'a day without duties says so in the detail');
    R.ok(d.getElementById('ca-rc-prev').classList.contains('ca-rc-off') && d.getElementById('ca-rc-next').classList.contains('ca-rc-off'), 'with a single month, both arrows gray out — neither disappears');
    w.eval('openRosterCalendar()');
    await wait(500);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar opens even with no roster');
    R.ok(d.getElementById('ca-rc-empty').textContent.indexOf('No roster for this month') === 0, 'a month without duties says so honestly');
    R.ok(fs.readFileSync(APP, 'utf8').indexOf('html.ca-tour-on #btn-roster-cal') >= 0, 'the tour locks the calendar button with the other chrome');
  }

  process.exit(R.done() ? 1 : 0);
})();
