// Roster calendar (v1.39.0 B6): the parser reads the roster's Duty column —
// flying days, layover days with their station, the OFF family, annual leave,
// standby and course codes — into a duty-day store, and the header's calendar
// icon opens a month grid of the whole roster. Tapping a flying day reopens
// its saved earnings entry or prefills its duty card.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
const path = require('path');

// Synthetic PDF items: the roster's rotated table (x = row, y = column).
// Columns: Start Date 21, Day 65, Flight 91, Sector 138, A/C 183, Duty 210,
// Rank 298, Rpt 328, STD 358, STA 388, FT 421.
const row = (x, cells) => cells.map(c => ({ str: c[1], x, y: c[0], page: 1 }));
const synthItems = [].concat(
    row(150, [[21, 'Start Date'], [65, 'Day'], [91, 'Flight'], [138, 'Sector'], [183, 'A/C'], [210, 'Duty'], [298, 'Rank'], [358, 'STD'], [388, 'STA'], [421, 'Flight'], [461, 'Duty'], [461, 'Time']]),
    row(180, [[21, '01Oct26'], [65, 'Thu'], [91, 'SQ 106'], [134, 'SIN-KUL'], [211, 'FLY'], [358, '0825'], [388, '0935']]),
    row(202, [[91, 'SQ 105'], [134, 'KUL-SIN'], [211, 'FLY'], [358, '1025'], [388, '1145']]),
    row(224, [[21, '02Oct26'], [65, 'Fri'], [143, 'MEL'], [207, 'LO']]),
    row(246, [[21, '03Oct26'], [65, 'Sat'], [143, 'SIN'], [207, 'ATDO']]),
    row(268, [[21, '04Oct26'], [65, 'Sun'], [143, 'SIN'], [207, 'AALV']]),
    row(290, [[21, '05Oct26'], [65, 'Mon'], [143, 'SIN'], [208, 'SN80']]),
    row(312, [[21, '06Oct26'], [65, 'Tue'], [91, 'SQ 207'], [134, 'SIN-MEL'], [211, 'FLY'], [358, '0100'], [388, '0900']]),
    // 07Oct: the generator prints NO date on a layover continuation row
    row(334, [[143, 'MEL'], [214, 'LO']]),
    row(356, [[21, '08Oct26'], [65, 'Wed'], [91, 'SQ 218'], [134, 'MEL-SIN'], [211, 'FLY'], [358, '2300'], [388, '0455']]),
    // the Duty Codes legend page — its rows must never become days
    row(600, [[30, 'Duty'], [70, 'Duty'], [120, 'Duty Codes'], [180, 'Duty Desc'], [188, 'Duty']]).map(i => Object.assign(i, { page: 2 })),
    row(650, [[68, 'ATDO'], [166, 'AUTO TAG DAY OFF']]).map(i => Object.assign(i, { page: 2 })),
    row(700, [[72, 'FLY'], [128, 'FLYING']]).map(i => Object.assign(i, { page: 2 })),
    row(750, [[68, 'SN60'], [158, 'NB STANDBY 0600-2200']]).map(i => Object.assign(i, { page: 2 }))
);

(async () => {
  // ---- the parser: duty days, kinds, and the dateless carry-forward ----
  {
    const { w } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(synthItems) + ')');
    R.eq(w.eval('window.__p.flights.length'), 4, 'the flights pass is untouched by duty-day parsing');
    const days = JSON.parse(w.eval('JSON.stringify(window.__p.days)'));
    const byYmd = {}; days.forEach(d => { byYmd[d.ymd] = d; });
    R.eq(days.length, 8, 'every duty row becomes exactly one day');
    R.eq(byYmd['2026-10-01'].kind, 'fly', 'a flying row is a fly day');
    R.ok(JSON.stringify(byYmd['2026-10-01'].fns) === JSON.stringify(['106', '105']), 'the day carries its flight numbers');
    R.eq(byYmd['2026-10-02'].kind + '@' + byYmd['2026-10-02'].loc, 'lo@MEL', 'a dated LO row is a layover day with its station');
    R.eq(byYmd['2026-10-03'].kind, 'off', 'ATDO is an OFF day (the owner\\u2019s code list)');
    R.eq(byYmd['2026-10-04'].kind, 'al', 'AALV is annual leave');
    R.eq(byYmd['2026-10-05'].kind + '[' + byYmd['2026-10-05'].code + ']', 'duty[SN80]', 'a standby code keeps its own label');
    R.eq(byYmd['2026-10-07'].kind + '@' + byYmd['2026-10-07'].loc, 'lo@MEL', 'a dateless LO row carries forward one day');
    R.ok(!byYmd['2026-10-09'] && !byYmd['2026-10-10'], 'the Duty Codes legend page never becomes days');
    // the OFF family, per the owner's list
    R.eq(w.eval("rosterParse([{str:'09Oct26',x:10,y:21,page:1},{str:'OFFD',x:10,y:207,page:1},{str:'EXDO',x:32,y:207,page:1},{str:'RQ99',x:54,y:207,page:1},{str:'RX99',x:76,y:207,page:1}].concat([{str:'Start Date',x:2,y:21,page:1},{str:'Duty',x:2,y:210,page:1}])).days.map(d=>d.kind).join(',')"), 'off,off,off,off', 'OFFD, EXDO, RQ99 and RX99 all read as OFF');
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
  }

  // ---- the real October 2026 roster: end-to-end honesty ----
  {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const file = path.resolve(__dirname, '../_inbox/October 2026.pdf');
    const data = new Uint8Array(fs.readFileSync(file));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
    const items = [];
    for (let pi = 1; pi <= doc.numPages; pi++) {
      const tc = await (await doc.getPage(pi)).getTextContent();
      tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
    }
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__p = rosterParse(' + JSON.stringify(items) + ')');
    R.eq(w.eval('window.__p.flights.length'), 15, 'the real October roster still parses its 15 flights');
    w.eval('upcomingRemember(window.__p)');
    const days = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    const oct = days['2026-10'];
    const nov = days['2026-11'] || [];
    const kind = (ymd) => { const d = oct.find(x => x.ymd === ymd) || nov.find(x => x.ymd === ymd); return d ? d.kind + (d.loc ? '@' + d.loc : '') : 'none'; };
    R.eq(kind('2026-10-01'), 'fly', 'real: 1 Oct is the SQ 106/105 turnaround');
    R.eq(kind('2026-10-03'), 'off', 'real: an ATDO day reads OFF');
    R.eq(kind('2026-10-04'), 'duty', 'real: a standby code keeps its label');
    R.eq(kind('2026-11-01'), 'lo@AMD', 'real: the dateless layover continuation lands on 1 Nov');

    // ---- the calendar UI on real data ----
    w.eval('openRosterCalendar()');
    await wait(500);
    const wrap = d.getElementById('ca-roster-cal');
    R.ok(wrap && !wrap.classList.contains('hidden'), 'the header calendar opens the sheet');
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('October 2026') === 0, 'it opens on the current month');
    const cells = Array.from(d.querySelectorAll('.ca-rc-cell[data-ymd]'));
    R.ok(cells.length >= 25, 'every duty day gets a cell');
    const first = cells.find(c => c.getAttribute('data-ymd') === '2026-10-01');
    R.ok(first && first.textContent.indexOf('SQ 106') >= 0, 'a turnaround day names both flights');
    R.ok(!!cells.find(c => c.classList.contains('is-today')), 'today carries the gold ring');
    R.ok(d.getElementById('ca-rc-legend').textContent.indexOf('Standby') >= 0, 'the legend explains every chip');
    // a flying day that has not flown prefills its duty card
    const future = cells.find(c => c.getAttribute('data-ymd') === '2026-10-27');
    R.ok(!!future, '27 Oct is on the calendar');
    future.click();
    await wait(900);
    const cards = d.querySelectorAll('[data-calc-card]');
    R.ok(cards.length >= 1, 'tapping a flying day builds its duty card');
    const newest = cards[cards.length - 1];
    R.eq((newest.querySelector('input[id$="-ifa-fn1"]') || {}).value, '164', 'the card prefills the duty\\u2019s first sector');
    R.eq((newest.querySelector('input[id$="-ifa-fn2"]') || {}).value, '163', 'and its homebound sector');
    R.ok(wrap.classList.contains('hidden'), 'the calendar steps aside for the card');
    // a saved entry reopens in place of the card
    w.eval("persistArchive([{ id: 'e1', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-29', flightType: 'Layover', stationDisplay: 'HKT', amount: 318.55 }])");
    w.eval('openRosterCalendar()');
    await wait(400);
    const savedCell = Array.from(d.querySelectorAll('.ca-rc-cell[data-ymd]')).find(c => c.getAttribute('data-ymd') === '2026-10-29');
    savedCell.click();
    await wait(500);
    R.ok(!d.getElementById('ca-arch-sub').classList.contains('hidden'), 'a saved duty reopens its earnings entry');
    w.eval('closeArchSub()');
    await wait(400);
    // OFF / standby taps speak plainly (through the bot queue, typing dots and all)
    w.eval("rosterCalOpenDay('2026-10-03')");
    let offSaid = false;
    for (let t = 0; t < 40 && !offSaid; t++) { await wait(200); offSaid = d.getElementById('chat-container').textContent.indexOf('OFF day') >= 0; }
    R.ok(offSaid, 'an OFF day says so in chat');
    // Escape closes the sheet
    w.eval('openRosterCalendar()');
    await wait(400);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
    R.ok(wrap.classList.contains('hidden'), 'Escape closes the roster calendar');
  }

  // ---- a clean device: honest empty state ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    w.eval('openRosterCalendar()');
    await wait(500);
    R.ok(!d.getElementById('ca-roster-cal').classList.contains('hidden'), 'the calendar opens even with no roster');
    R.ok(d.getElementById('ca-rc-empty').textContent.indexOf('No roster for this month') === 0, 'a month without duties says so honestly');
    R.ok(fs.readFileSync(APP, 'utf8').indexOf('html.ca-tour-on #btn-roster-cal') >= 0, 'the tour locks the calendar button with the other chrome');
  }

  process.exit(R.done() ? 1 : 0);
})();
