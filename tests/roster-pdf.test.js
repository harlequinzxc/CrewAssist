// Roster PDF import: parser (columns/rows/echo merge/trip chaining), the confirm
// bubble, and card prefill. All rosters here are SYNTHETIC — they mirror the
// real generator's rotated-table geometry (x = row axis, y = column axis,
// 22pt row pitch) but contain no real personal data.
const H = require('./_harness');
const { R, boot, wait, APP } = H;

// --- synthetic geometry mirroring the real Crew Roster Report ---
const Y = { date: 25, day: 65, fn: 90, sector: 135, std: 359, sta: 389, ft: 421 };
const mk = (str, x, y, page = 1) => ({ str, x, y, page });

function buildRoster(rows, page2From = Infinity) {
  const items = [];
  const hdr = (page) => {
    const p = page;
    items.push(mk('Start', 150, 27, p), mk('Date', 161, 26.5, p));
    items.push(mk('Day', 150, Y.day, p));
    items.push(mk('Flight', 150, 94, p), mk('Number', 161, Y.fn, p));
    items.push(mk('Sector', 150, 138, p));
    items.push(mk('Duty', 150, 209, p));
    items.push(mk('Rpt', 150, 330, p), mk('STD', 150, Y.std, p), mk('STA', 150, Y.sta, p));
    items.push(mk('Flight', 150, Y.ft, p), mk('Time', 150, Y.ft + 0.3, p));
  };
  hdr(1);
  // junk that must be ignored: personal header line and From--To dates
  items.push(mk('From', 62, 317), mk('01Jul26', 62, 365.5), mk('--', 62, 415), mk('31Jul26', 62, 430.5));
  items.push(mk('Personal Details', 62, 60), mk('Roster Some Name', 80, 60), mk('350,737,777', 128, 130));
  rows.forEach((r, i) => {
    const page = i >= page2From ? 2 : 1;
    if (page === 2 && i === page2From) hdr(2);
    const x = 180 + (i % page2From) * 22;
    if (r.date) items.push(mk(r.date, x, Y.date, page));
    if (r.day) items.push(mk(r.day, x, Y.day, page));
    if (r.fn) items.push(mk(r.fn, x, r.fny != null ? r.fny : Y.fn, page));
    if (r.sector) items.push(mk(r.sector, x, r.secy != null ? r.secy : Y.sector, page));
    if (r.std) items.push(mk(r.std, x, Y.std, page));
    if (r.sta) items.push(mk(r.sta, x, Y.sta, page));
    if (r.ft) items.push(mk(r.ft, x, Y.ft, page));
    if (r.duty) items.push(mk(r.duty, x, 209.2, page));
  });
  return items;
}

// One rich synthetic month: layover with split overnight flight + echo,
// 4-sector shuttle day, same-day turnaround, overnight turnaround (CCU-style),
// 4-sector US layover with an echo, repeated flight number later in the month,
// and an open-ended trip at month end.
const MONTH = [
  { date: '01Jul26', day: 'Wed' },
  { fn: 'SQ 442', sector: 'SIN-KTM', std: '1914', sta: '2155', ft: '04:56' },
  { date: '02Jul26', day: 'Thu' },
  { fn: 'SQ 441', sector: 'KTM-SIN', std: '2259', ft: '05:15' },          // op: STD only
  { date: '03Jul26', day: 'Fri' },
  { fn: 'SQ 441', sector: 'KTM-SIN', sta: '0629' },                        // echo: STA only
  { date: '04Jul26', day: 'Sat', duty: 'ATDO' },
  { date: '22Jul26', day: 'Wed' },
  { fn: 'SQ 740', sector: 'SIN-HKT', std: '1912', sta: '2000', ft: '01:48' },
  { fn: 'SQ 739', sector: 'HKT-SIN', std: '2048', sta: '2340', ft: '01:52' },
  { date: '24Jul26', day: 'Fri' },
  { fn: 'SQ 134', sector: 'SIN-PEN', std: '0937', sta: '1102', ft: '01:25' },
  { fn: 'SQ 133', sector: 'PEN-SIN', std: '1153', sta: '1321', ft: '01:28' },
  { fn: 'SQ 138', sector: 'SIN-PEN', std: '1553', sta: '1719', ft: '01:26' },
  { fn: 'SQ 137', sector: 'PEN-SIN', std: '1809', sta: '1946', ft: '01:37' },
  { date: '25Jul26', day: 'Sat' },
  { fn: 'SQ 516', sector: 'SIN-CCU', std: '2040', sta: '2235', ft: '04:25' },
  { fn: 'SQ 517', sector: 'CCU-SIN', std: '2330', sta: '0430', ft: '04:30' }, // overnight T/A, STA<STD
  { date: '05Sep26', day: 'Sat' },
  { fn: 'SQ 12', sector: 'SIN-NRT', std: '0933', sta: '1727', ft: '06:54' },
  { date: '06Sep26', day: 'Sun' },
  { fn: 'SQ 12', sector: 'NRT-LAX', std: '1848', sta: '1259', ft: '10:11' },
  { date: '08Sep26', day: 'Tue' },
  { fn: 'SQ 11', sector: 'LAX-NRT', std: '1414', sta: '1703', ft: '10:49' },
  { date: '11Sep26', day: 'Fri' },
  { fn: 'SQ 11', sector: 'NRT-SIN', std: '1908', ft: '06:51' },            // op
  { date: '12Sep26', day: 'Sat' },
  { fn: 'SQ 11', sector: 'NRT-SIN', sta: '0059' },                          // echo
  { date: '10Aug26', day: 'Mon' },
  { fn: 'SQ 134', sector: 'SIN-PEN', std: '0800', sta: '0915', ft: '01:25' }, // repeat: own full times
  { fn: 'SQ 133', sector: 'PEN-SIN', std: '1000', sta: '1125', ft: '01:25' },
  { date: '31Oct26', day: 'Sat' },
  { fn: 'SQ 504', sector: 'SIN-AMD', std: '1840', sta: '2150', ft: '05:40' } // open-ended
];

(async () => {
  // ---- parser: full synthetic month ----
  {
    const { w } = await boot(APP);
    const r = w.rosterParse(buildRoster(MONTH));
    const ok = r.trips.filter(t => t.ok);
    const flagged = r.trips.filter(t => !t.ok);
    R.eq(r.monthLabel, '2026-07', 'month label from first date anchor');
    R.eq(ok.length, 6, 'six buildable trips');
    R.eq(flagged.length, 1, 'one flagged trip');
    R.ok(/does not return to Singapore/.test(flagged[0].reason), 'open-ended trip flagged honestly');

    const ktm = ok[0];
    R.eq(ktm.type, 'Layover', 'KTM trip classified Layover');
    R.eq(ktm.sectors[1].staHm, '06:29', 'echo row merged its STA');
    R.eq(ktm.sectors[1].arrDate, '2026-07-03', 'echo row date became arrival date');
    R.eq(ktm.stations.length, 1, 'KTM trip has one station');
    R.eq(ktm.stations[0].code, 'KTM', 'station code');
    R.eq(ktm.stations[0].inTime, '21:55', 'station in time = inbound STA');
    R.eq(ktm.stations[0].outTime, '22:59', 'station out time = outbound STD');

    const hkt = ok[1];
    R.eq(hkt.type, 'Turnaround', 'same-day pair is a Turnaround');

    const pen = ok[2];
    R.eq(pen.sectors.length, 4, 'two same-day pairs merged into one 4-sector day');
    R.eq(pen.type, 'Turnaround', '4-sector shuttle day is a Turnaround');

    const ccu = ok[3];
    R.eq(ccu.type, 'Turnaround', 'overnight ground (55min) is still a Turnaround');
    R.eq(ccu.sectors[1].arrDate, '2026-07-26', 'STA < STD on same row rolls arrival date +1');

    const us = ok[4];
    R.eq(us.sectors.length, 4, 'US trip has 4 sectors');
    R.eq(us.type, 'Layover', 'US trip is a Layover');
    R.eq(us.stations.map(s => s.code).join(','), 'NRT,LAX,NRT', 'three distinct layover stops kept separate');
    R.eq(us.stations[1].inDate, '2026-09-07', 'LAX in date = next-day arrival of NRT-LAX');

    const rep = ok[5];
    R.eq(rep.sectors[0].stdHm, '08:00', 'repeated flight later in month parsed as its own operation');
    R.eq(r.flights.length, 17, '17 operating flights (echoes never double-counted)');
    R.ok(r.skippedDays >= 1, 'non-flying day counted');
  }

  // ---- parser: mid-column splits and junk must not change the answer ----
  {
    const { w } = await boot(APP);
    const clean = w.rosterParse(buildRoster(MONTH));
    // shift several sector/fn values a few points off-column (the real
    // generator does this mid-table) and re-run
    const split = buildRoster(MONTH.map((row, i) => (i % 3 === 0 && row.sector) ? { ...row, secy: Y.sector - 4.5, fny: Y.fn + 3.2 } : row));
    const messy = w.rosterParse(split);
    R.eq(messy.trips.length, clean.trips.length, 'column splits do not change trip count');
    R.eq(messy.flights.length, clean.flights.length, 'column splits do not lose flights');
    R.eq(JSON.stringify(messy.trips.map(t => t.sectors.map(s => s.dep + s.arr))), JSON.stringify(clean.trips.map(t => t.sectors.map(s => s.dep + s.arr))), 'identical routes despite splits');
  }

  // ---- parser: not a roster ----
  {
    const { w } = await boot(APP);
    const junk = w.rosterParse([
      mk('Inflight Menu', 100, 100), mk('Main Course', 100, 130), mk('Chicken Rice', 100, 160),
      mk('SQ', 100, 200), mk('2026', 100, 230), mk('From', 62, 317), mk('01Jul26', 62, 365)
    ]);
    R.eq(junk.flights.length, 0, 'menu-like PDF yields no flights');
  }

  // ---- parser: table split across two pages, op/echo pair straddling the break ----
  {
    const { w } = await boot(APP);
    const rows = [
      { date: '08Jul26', day: 'Wed' },
      { fn: 'SQ 324', sector: 'SIN-AMS', std: '0012', sta: '0742', ft: '13:30' },
      { fn: 'SQ 323', sector: 'AMS-SIN', std: '1032', ft: '12:18' },   // last row of page 1
      { date: '09Jul26', day: 'Thu' },
      { fn: 'SQ 323', sector: 'AMS-SIN', sta: '0450' }                  // echo lands on page 2
    ];
    const r = w.rosterParse(buildRoster(rows, 3));
    R.eq(r.flights.length, 2, 'cross-page echo merged, not duplicated');
    R.eq(r.trips[0].ok, true, 'cross-page trip is buildable');
    R.eq(r.trips[0].sectors[1].arrDate, '2026-07-09', 'echo on page 2 carries the landing date');
  }

  // ---- UI: paperclip, hidden input, chat command ----
  {
    const { w, d } = await boot(APP);
    const btn = d.getElementById('btn-roster');
    const inp = d.getElementById('roster-file-input');
    R.ok(!!btn, 'paperclip button exists');
    R.ok(btn.querySelector('[data-lucide="paperclip"]'), 'paperclip uses the lucide paperclip icon');
    R.ok(btn.nextElementSibling === d.getElementById('chat-input'), 'paperclip sits left of the input');
    R.ok(/pdf/.test(inp.getAttribute('accept')), 'file input accepts PDF');
    R.eq(inp.hasAttribute('multiple'), true, 'file input allows multiple PDFs');
    let opened = 0;
    w.openRosterPicker = () => { opened++; };
    w.analyzeIntent('upload my roster');
    await wait(550);
    R.eq(opened, 1, '"upload" intent opens the roster picker');
    w.analyzeIntent('roster please');
    await wait(550);
    R.eq(opened, 2, '"roster" keyword also opens the picker');
  }

  // ---- UI: non-PDF rejection bubble ----
  {
    const { w, d } = await boot(APP);
    await w.handleRosterFiles([{ name: 'notes.txt', type: 'text/plain' }]);
    await wait(1600);
    const txt = d.getElementById('chat-container').textContent;
    R.ok(/doesn't look like a PDF/.test(txt), 'non-PDF rejected with a clear bubble');
  }

  // ---- UI: regression — the live FileList bug ----
  // In browsers, input.value = '' empties e.target.files IN PLACE. The change
  // handler must snapshot the files before clearing, or "nothing happens"
  // after picking a PDF (the v1.20.0 bug on a real device).
  {
    const { w, d } = await boot(APP);
    const inp = d.getElementById('roster-file-input');
    let got = -1;
    w.handleRosterFiles = (fl) => { got = fl.length; };
    const fakeFile = { name: 'July 2026.pdf', type: 'application/pdf' };
    let chosen = true;
    const live = { get length() { return chosen ? 1 : 0; }, item: () => (chosen ? fakeFile : null), 0: fakeFile };
    Object.defineProperty(inp, 'files', { configurable: true, get: () => live });
    Object.defineProperty(inp, 'value', { configurable: true, get: () => (chosen ? 'x' : ''), set: (v) => { if (v === '') chosen = false; } });
    inp.dispatchEvent(new w.Event('change', { bubbles: true }));
    R.ok(got === 1, 'files snapshotted before the input is cleared (live FileList regression)');
    R.eq(inp.value, '', 'input reset so the same file can be re-picked');
  }

  // ---- parser + stitching: a trip crossing a month boundary ----
  // Out on 29 Jun, back on 2 Jul: open-ended in June's report, mid-trip in
  // July's, complete when both months are stitched into one timeline.
  {
    const { w, d } = await boot(APP);
    const june = buildRoster([
      { date: '29Jun26', day: 'Mon' },
      { fn: 'SQ 324', sector: 'SIN-AMS', std: '2350', sta: '0742', ft: '13:30' } // arr 30 Jun (STA < STD)
    ]);
    const july = buildRoster([
      { date: '02Jul26', day: 'Thu' },
      { fn: 'SQ 323', sector: 'AMS-SIN', std: '1030', sta: '0445', ft: '12:15' } // arr 3 Jul
    ]);
    const juneAlone = w.rosterParse(june);
    R.eq(juneAlone.trips[0].ok, false, 'June alone: boundary trip flagged');
    R.ok(/does not return to Singapore/.test(juneAlone.trips[0].reason), 'June alone: open-ended reason');
    const julyAlone = w.rosterParse(july);
    R.eq(julyAlone.trips[0].ok, false, 'July alone: fragment flagged');
    R.ok(/starts outside Singapore/.test(julyAlone.trips[0].reason), 'July alone: mid-trip reason');
    const stitched = w.rosterParse(w.rosterStitchItems([june, july]));
    R.eq(stitched.trips.length, 1, 'stitched: one trip');
    R.eq(stitched.trips[0].ok, true, 'stitched: boundary trip is buildable');
    R.eq(stitched.trips[0].type, 'Layover', 'stitched: 51h ground makes it a Layover');
    R.eq(stitched.trips[0].stations[0].code, 'AMS', 'stitched: station');
    R.eq(stitched.trips[0].stations[0].inDate, '2026-06-30', 'stitched: AMS in date');
    R.eq(stitched.trips[0].stations[0].outDate, '2026-07-02', 'stitched: AMS out date');
    R.eq(stitched.trips[0].sectors[0].depDate, '2026-06-29', 'stitched: sector 1 departs 29 Jun');
    R.eq(stitched.trips[0].sectors[1].depDate, '2026-07-02', 'stitched: sector 2 departs 2 Jul');
    w.renderRosterConfirm(stitched, 'June 2026.pdf + July 2026.pdf', 'June 2026 – July 2026');
    await wait(100);
    const btxt = d.getElementById('chat-container').lastElementChild.textContent;
    R.ok(/June 2026 – July 2026/.test(btxt), 'multi-month bubble shows the span label');
  }

  // ---- UI: handleRosterFiles orchestrates a multi-month batch ----
  // Stubbed reader; checks dedupe-by-month, ordering, and the stitched bubble.
  {
    const { w, d } = await boot(APP);
    const june = buildRoster([
      { date: '29Jun26', day: 'Mon' },
      { fn: 'SQ 324', sector: 'SIN-AMS', std: '2350', sta: '0742', ft: '13:30' }
    ]);
    const july = buildRoster([
      { date: '02Jul26', day: 'Thu' },
      { fn: 'SQ 323', sector: 'AMS-SIN', std: '1030', sta: '0445', ft: '12:15' }
    ]);
    w.rosterReadPdf = async (f) => (/July/.test(f.name) ? july : june);
    await w.handleRosterFiles([
      { name: 'July 2026.pdf', type: 'application/pdf' },
      { name: 'June 2026.pdf', type: 'application/pdf' },
      { name: 'June 2026 (1).pdf', type: 'application/pdf' }
    ]);
    await wait(1600);
    const txt = d.getElementById('chat-container').textContent;
    R.ok(/June 2026 \(1\)\.pdf covers a month already in this batch/.test(txt), 'duplicate month named in skip message');
    R.ok(/kept the first, skipped the rest/.test(txt), 'skip message explains the resolution');
    const bubble = d.getElementById('chat-container').lastElementChild;
    const bt = bubble.textContent;
    R.ok(/June 2026\.pdf \+ July 2026\.pdf/.test(bt), 'bubble names both files');
    R.ok(/June 2026 – July 2026/.test(bt), 'bubble shows the stitched span');
    R.ok(/1 trip · 2 sectors/.test(bt), 'boundary trip is complete in the stitched count');
    R.ok(!/not built/.test(bt), 'nothing flagged in the stitched timeline');
  }

  // ---- UI: confirm bubble -> Build -> prefilled cards ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    const chat = d.getElementById('chat-container');
    const bubble = chat.lastElementChild;
    const btxt = bubble.textContent;
    R.ok(/Test Month\.pdf/.test(btxt), 'bubble names the file');
    R.ok(/6 trips/.test(btxt), 'bubble reports the trip count');
    R.ok(/SIN–AMD/.test(btxt) && /not built/.test(btxt), 'flagged trip reported in the bubble');
    const buildBtn = bubble.querySelector('.roster-build-btn');
    const discardBtn = bubble.querySelector('.roster-discard-btn');
    R.ok(!!buildBtn && !!discardBtn, 'Build and Discard buttons exist');
    buildBtn.click();
    await wait(700);
    const cards = d.querySelectorAll('[data-calc-card]');
    R.eq(cards.length, 6, 'Build creates one card per buildable trip');
    R.eq(buildBtn.disabled, true, 'Build is one-shot (spent)');

    // card 1: KTM layover — IFA + LMA prefilled
    const id1 = 'calc-1';
    R.eq(d.getElementById(`${id1}-flight-type`).value, 'Layover', 'KTM card flight type');
    R.eq(d.getElementById(`${id1}-ifa-fn1`).value, '442', 'sector 1 flight number prefilled');
    R.eq(d.getElementById(`${id1}-ifa-t1`).value, '04:56', 'sector 1 flight time prefilled');
    R.eq(d.getElementById(`${id1}-ifa-d1`).value, '2026-07-01', 'sector 1 departure date prefilled');
    R.eq(d.getElementById(`${id1}-ifa-d2`).value, '2026-07-02', 'sector 2 date from STD row');
    R.eq(d.getElementById(`${id1}-lma-iata1`).value, 'KTM', 'LMA station prefilled');
    R.eq(d.getElementById(`${id1}-lma-at1`).value, '21:55', 'LMA arrival time = inbound STA');
    R.eq(d.getElementById(`${id1}-lma-a1`).value, '2026-07-01', 'LMA arrival date');
    R.eq(d.getElementById(`${id1}-lma-dt1`).value, '22:59', 'LMA departure time = outbound STD');
    R.eq(d.getElementById(`${id1}-lma-d1`).value, '2026-07-02', 'LMA departure date');
    R.eq(d.getElementById(`${id1}-btn-calc`).disabled, false, 'complete trip leaves Calculate armed');

    // card 2: HKT turnaround — LMA section hidden, 2 sectors
    const id2 = 'calc-2';
    R.eq(d.getElementById(`${id2}-flight-type`).value, 'Turnaround', 'HKT card is a Turnaround');
    R.ok(d.getElementById(`${id2}-lma-wrap`).classList.contains('hidden'), 'turnaround hides LMA section');

    // card 3: PEN 4-sector shuttle day
    const id3 = 'calc-3';
    R.eq(d.getElementById(`${id3}-sector-count`).value, '4', 'PEN day is a 4-sector card');
    R.eq(d.getElementById(`${id3}-ifa-fn4`).value, '137', 'sector 4 flight number prefilled');

    // card 5: US 4-sector layover — three LMA stations
    const id5 = 'calc-5';
    R.eq(d.getElementById(`${id5}-sector-count`).value, '4', 'US trip is a 4-sector card');
    R.eq(d.getElementById(`${id5}-lma-iata1`).value, 'NRT', 'US station 1');
    R.eq(d.getElementById(`${id5}-lma-iata2`).value, 'LAX', 'US station 2');
    R.eq(d.getElementById(`${id5}-lma-iata3`).value, 'NRT', 'US station 3 (return stop kept separate)');
    R.eq(d.getElementById(`${id5}-lma-at2`).value, '12:59', 'LAX in time');
  }

  // ---- UI: Calculate all — one tap builds + calculates every trip ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    const bubble = d.getElementById('chat-container').lastElementChild;
    const calcAllBtn = bubble.querySelector('.roster-calc-all-btn');
    R.ok(!!calcAllBtn, 'Calculate all button sits under Build/Discard');
    calcAllBtn.click();
    await wait(1000);
    const cards = Array.from(d.querySelectorAll('[data-calc-card]'));
    R.eq(cards.length, 6, 'Calculate all builds the cards too');
    R.ok(cards.every(c => c.classList.contains('ca-folded')), 'every card folded, like a manual Calculate');
    const backdrop = d.getElementById('results-backdrop');
    R.ok(!backdrop.classList.contains('hidden'), 'combined summary opens');
    const txt = d.getElementById('results-content').textContent;
    R.ok(/Grand Total — 6 trips/.test(txt), 'header totals all six trips');
    // The combined total must equal the sum of the individual card results.
    const expect = [1, 2, 3, 4, 5, 6].reduce((n, i) => n + w.computeCardResults(`calc-${i}`, 'both').grandTotal, 0);
    R.ok(txt.indexOf(w.formatMoney(expect)) !== -1, 'combined grand total = sum of the per-trip totals');
    R.ok(/LMA is not eligible for Turnaround flights/.test(txt), 'turnaround trips keep the honest LMA note');
    R.ok(/SIN–KTM–SIN/.test(txt), 'per-trip sections carry their routes');
    R.ok(bubble.querySelector('.roster-build-btn').disabled && bubble.querySelector('.roster-discard-btn').disabled && calcAllBtn.disabled, 'Calculate all spends the whole footer');
    // Save: one tap files every trip as its own archive entry, one-shot
    const ab = d.getElementById('btn-results-action');
    R.ok(!ab.classList.contains('hidden'), 'save action offered on the combined summary');
    ab.click();
    await wait(150);
    const arch = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.eq(arch.length, 6, 'one tap saves six archive entries');
    R.eq(arch.filter(e => e.monthKey === '2026-07').length, 4, 'July trips file under July');
    R.ok(arch.some(e => e.monthKey === '2026-09' && e.stationDisplay === 'NRT/LAX'), 'US trip files under its own sector-1 month');
    R.eq(ab.dataset.done, '1', 'combined save is one-shot');
    ab.click();
    await wait(50);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, arch.length, 'second tap saves nothing');
    d.getElementById('btn-close-results').click();
    await wait(400);
    R.ok(backdrop.classList.contains('hidden'), 'combined summary closes');
  }

  // ---- UI: Build first, Calculate all still available after ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    const bubble = d.getElementById('chat-container').lastElementChild;
    bubble.querySelector('.roster-build-btn').click();
    await wait(700);
    R.eq(d.querySelectorAll('[data-calc-card]').length, 6, 'Build made the cards');
    const calcAllBtn = bubble.querySelector('.roster-calc-all-btn');
    R.eq(calcAllBtn.disabled, false, 'Calculate all stays available after Build');
    calcAllBtn.click();
    await wait(1000);
    R.ok(!d.getElementById('results-backdrop').classList.contains('hidden'), 'combined summary opens after a manual Build');
    R.ok(/Grand Total — 6 trips/.test(d.getElementById('results-content').textContent), 'all trips included after Build');
  }

  // ---- UI: Flight Overview in the single-trip summary ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    d.getElementById('chat-container').lastElementChild.querySelector('.roster-build-btn').click();
    await wait(700);
    d.getElementById('calc-1-btn-calc').click();
    await wait(400);
    const txt = d.getElementById('results-content').textContent;
    R.ok(/Flight Overview/.test(txt), 'single summary carries the Flight Overview');
    R.ok(/Kathmandu overnight/.test(txt), 'personal voice');
    R.ok(/2155H/.test(txt), 'landing time in the Sat 5th Sep 1727H format');
    R.ok(/just missing dinner/.test(txt), 'missed-meal aside with the window close time');
    R.ok(/SDPs of 7H 26M and 6H 45M/.test(txt), 'SDP kept as a term');
    R.ok(/\$13\.50\/hr/.test(txt), 'rank rate formatted to two decimals');
    R.ok(/South Asia rates/.test(txt), 'KTM maps to South Asia (NP region fix)');
    R.ok(/\$360\.72 altogether/.test(txt), 'grand total closes the paragraph');
    d.getElementById('btn-close-results').click();
    await wait(400);
  }

  // ---- UI: Flight Overview per trip in Calculate all + archive tap-through ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    d.getElementById('chat-container').lastElementChild.querySelector('.roster-calc-all-btn').click();
    await wait(1000);
    R.eq(d.querySelectorAll('#results-content [data-lucide="sparkles"]').length, 6, 'one Flight Overview per trip');
    const txt = d.getElementById('results-content').textContent;
    R.ok(/The big one: Tokyo Narita and Los Angeles, Sat 5th Sep – Fri 11th Sep/.test(txt), 'multi-sector range spans to the last departure');
    R.ok(/landing Sat 5th Sep 1727H/.test(txt), 'owner-locked date-time format');
    R.ok(/no Direct US on this one/.test(txt) && /straight SIN–US–SIN/.test(txt), 'Direct US rule stated on multi-sector US trips');
    R.ok(/two Tokyo Narita stays plus Los Angeles/.test(txt), 'station list phrase groups repeats');
    R.ok(/two turnaround bonuses/.test(txt), 'bonus count in words');
    // save all, then reopen one trip from the archive
    d.getElementById('btn-results-action').click();
    await wait(200);
    const arch = JSON.parse(w.localStorage.getItem('crewAssist.archive'));
    R.ok(arch.every(e => e.detail && e.detail.sectors && e.detail.sectors.length), 'every saved entry carries its snapshot');
    w.showArchiveOverlay();
    await wait(100);
    d.querySelectorAll('.ca-arch-row')[0].click();
    await wait(400);
    const sheet = d.getElementById('ca-arch-sub-sheet').textContent;
    R.ok(/Flight Overview/.test(sheet) && /IFA Breakdown/.test(sheet), 'archive reopen shows overview + breakdowns');
    R.ok(/The big one:/.test(sheet), 'overview regenerated from the frozen snapshot');
  }

  // ---- UI: Discard builds nothing ----
  {
    const { w, d } = await boot(APP);
    const parsed = w.rosterParse(buildRoster(MONTH));
    w.renderRosterConfirm(parsed, 'Test Month.pdf');
    await wait(100);
    const bubble = d.getElementById('chat-container').lastElementChild;
    bubble.querySelector('.roster-discard-btn').click();
    await wait(700);
    R.eq(d.querySelectorAll('[data-calc-card]').length, 0, 'Discard builds no cards');
    R.ok(bubble.querySelector('.roster-discard-btn').classList.contains('pointer-events-none'), 'Discard is one-shot');
    R.ok(bubble.querySelector('.roster-build-btn').disabled, 'Discard spends Build');
    R.ok(bubble.querySelector('.roster-calc-all-btn').disabled, 'Discard spends Calculate all');
  }

  process.exit(R.done());
})().catch(e => { console.error(e); process.exit(1); });
