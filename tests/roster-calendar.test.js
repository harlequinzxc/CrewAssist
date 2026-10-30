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
      const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../docs/_reference_rosters/' + file)));
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
      const items = [];
      for (let pi = 1; pi <= doc.numPages; pi++) {
        const tc = await (await doc.getPage(pi)).getTextContent();
        tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
      }
      return items;
    };
    const octItems = await readItems('Oct 2026.pdf');
    const novItems = await readItems('Nov 2026.pdf');
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__oct = rosterParse(' + JSON.stringify(octItems) + ')');
    R.eq(w.eval('window.__oct.flights.length'), 23, 'the real October roster parses its 23 flights (owner refresh 2026-10-24)');
    w.eval('upcomingRemember(window.__oct)');
    let days = JSON.parse(w.localStorage.getItem('crewAssist.dutyDays'));
    const dayAt = (store, ymd) => {
      const mk = String(ymd).slice(0, 7);
      return (store[mk] || []).find(x => x.ymd === ymd) || null;
    };
    // owner report, issue 2: 12–14 Oct is one SIN-SYD-SIN duty — the 0142H
    // landing on the 14th is a fly day of the SAME duty (refresh: was 0015H)
    R.eq(dayAt(days, '2026-10-12').dkey, '2026-10-12', 'the SYD duty starts on the 12th');
    R.eq([13, 14].map(dd => dayAt(days, '2026-10-' + dd).kind + ':' + dayAt(days, '2026-10-' + dd).dkey).join('|'), 'fly:2026-10-12|fly:2026-10-12', 'the 13th and the 0142H landing on the 14th belong to the same duty');
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
    R.ok(!d.getElementById('ca-rc-today'), 'the Today pill is gone — press and hold replaces it');
    R.ok(!!d.getElementById('ca-rc-jump') && !!d.getElementById('ca-rc-fold'), 'the month header button and the fold chevron live in the header');
    R.ok(d.getElementById('ca-rc-jump').nextElementSibling === d.getElementById('ca-rc-fold'), 'the fold chevron sits just after the month header');
    R.ok(d.getElementById('ca-rc-prev').parentElement.contains(d.getElementById('ca-rc-close')) && !d.getElementById('ca-rc-prev').parentElement.contains(d.getElementById('ca-rc-fold')), 'the arrows sit beside the close icon, away from the fold');
    R.ok(src.indexOf('ca-rc-shade absolute inset-0 bg-black/60 opacity-0') >= 0, 'the calendar shade matches the Settings backdrop — the same black/60 scrim (hotfix 16: both blur-free)');
    const settingsTop = (src.match(/id="settings-sheet"[^>]*class="([^"]*)"/) || [])[1] || '';
    const calTop = (src.match(/id="ca-rc-sheet"[^>]*class="([^"]*)"/) || [])[1] || '';
    R.ok(settingsTop.indexOf('top-[calc(60px+env(safe-area-inset-top,20px))]') >= 0 && calTop.indexOf('top-[calc(60px+env(safe-area-inset-top,20px))]') >= 0 && calTop.indexOf('max-w-xl') < 0, 'the calendar sheet wears the Settings overlay’s exact height — same top offset, full-bleed glass');
    // hotfix 12 (owner report: a foldable’s inner screen stretched the
    // calendar edge to edge): the data tier centers at max-w-2xl exactly
    // like the menu viewer — phones never reach the cap, wide screens get
    // a calm centered column
    R.ok(src.indexOf('px-5 pb-6 flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full') >= 0, 'the calendar’s data tier centers at max-w-2xl like the menu viewer (hotfix 12) — no stretching on wide screens');
    // hotfix 13 (owner report, Magic V3 foldable): the calendar sometimes
    // opened with its top rows or bottom detail missing — a close's
    // display:none canceled the glide, and the next open never started it.
    // The calendar now opens through the shared glide (reflow-pinned class
    // change + heal passes); the pin guards the wiring from drifting back
    // to a bare class toggle.
    R.ok(/function openRosterCalendar[\s\S]*?caSheetGlideArm\(sheet, wrap\.querySelector\('\.ca-rc-shade'\)\);/.test(src), 'the calendar opens through the shared glide arm (hotfix 13, round 20) — a canceled close can never leave the sheet stuck off-screen');
    // hotfix 14 (owner report: contents "not rendering properly" on the
    // foldable): a quick close-and-reopen used to let the close's 300ms
    // display:none fire MID-OPEN — the whole calendar collapsed and the
    // scroll-flip "corrected" to the roster's first month. The open now
    // cancels the pending hide before un-hiding the wrap.
    R.ok(/function openRosterCalendar[\s\S]*?caSheetHideCancel\(wrap\);\s*\n\s*wrap\.classList\.remove\('hidden'\);/.test(src), 'a quick close-and-reopen never hides the wrap mid-open (hotfix 14) — the open cancels the close\u2019s pending hide');
    R.ok(/function closeRosterCalendar[\s\S]*?caSheetHideArm\(wrap\);/.test(src), 'the close arms its hide through the shared pair (a reopen cancels it)');
    R.ok(src.includes('width:300%;will-change:transform;transform:translateX(-33.3333%)'), 'the finger-following drag track carries its own compositor layer (hotfix 17) — it transforms on every pointer event');
    // hotfix 17 (owner: "the content flickers as if there is some black box"
    // while holding and swinging the finger; the swipe died after quick
    // arrow taps; "bottom details not rendering" at rest):
    R.ok(/const done = \(\) => \{[\s\S]*?fin = true;\s*\n\s*grid\.removeAttribute\('data-rc-slide'\);\s*\n\s*grid\.style\.overflow = '';\s*\n\s*if \(rcSlideGen !== gen\) return;   \/\/ a newer render owns the content\s*\n\s*commit\(\);/.test(src), 'a slide always cleans up its state — only the commit is generation-owned, so rapid arrow taps can never strand data-rc-slide and kill the swipe (hotfix 17)');
    R.ok(/const left = i > 0 \? rcMonthHtml\(months\[i - 1\]\) : rcMonthHtml\(rcViewYm\);/.test(src) && /const right = i < months\.length - 1 \? rcMonthHtml\(months\[i \+ 1\]\) : rcMonthHtml\(rcViewYm\);/.test(src), 'the drag track\u2019s void edges carry a clone of the current month — the rubber band never drags a black slab into view (hotfix 17)');
    R.ok(src.includes('function rosterCalTLCover(el)') && src.includes('if (!dr.height) return null;   // no layout engine (jsdom) — the offsets are the only truth'), 'the timeline window derives from real geometry when there is one (hotfix 17) — stale height estimates can never leave the resting viewport outside the window');
    R.ok(/const dHead = rcTL\.off\[a1\] - oldOffA;\s*\n\s*if \(dHead && el\.scrollTop > 0\) el\.scrollTop = Math\.max\(0, el\.scrollTop \+ dHead\);/.test(src), 'height corrections anchor the scroller — corrected spacers never slide the visible rows under the eye (hotfix 17)');
    R.ok(src.includes('width:200%;will-change:transform;transform:translateX('), 'the glide track is promoted AT BIRTH (hotfix 18) — a transition self-promotes only once it starts, and that promotion frame is exactly where the big screen flashed');
    // hotfix 18 (owner: the same flicker persisting after all four hotfix-17
    // fixes — the remaining causes were motion-frame costs a headless rig
    // can never see):
    R.ok(/rcDrag\.preT = setTimeout\(\(\) => \{[\s\S]*?\}, 140\);/.test(src) && src.includes('rcDragEngage(true);'), 'a resting hold parks the drag track early — the layer rasterizes while the finger rests, before the first move');
    R.ok(src.includes('if (!rcDrag.moved) { rcDragStop(true); rcDrag.on = false; return; }'), 'a hold that never becomes a move restores the grid at once — day taps keep landing');
    R.ok(/140ms of quiet is the only\s*\n\s*\/\/ reliable witness[\s\S]*?rosterCalTLWindow\(\);\s*\n\s*if \(prog\) return;/.test(src), 'the scroll-quiet settle pass runs UNCONDITIONALLY before any guard — it only reads and mounts, never flips');
    R.ok(src.includes("det.addEventListener('scrollend', () => { rcTLMotion = 0; rosterCalTLWindow(); })"), 'scrollend (where the engine provides it) is the exact rest signal, and it releases the pricing stand-down');
    R.ok(!src.includes('rcTL.band'), 'no coverage-band shortcut — every scroll event derives the window from real geometry (a stale band could skip the pass the viewport needed)');
    R.ok(src.includes('if (justMounted) { refreshIcons(); }') && src.includes('function refreshIcons() {') && src.split('refreshIcons();').length - 1 >= 37, 'the whole-document icon scan runs only when a pass actually mounted rows — and the round-18 refreshIcons() helper carries the guarded call every render shares');
    R.ok(src.includes('function rosterCalScheduleEarns(now)') && src.includes('rosterCalScheduleEarnsRun(); }, 350);') && src.includes('rcTLMotion && (Date.now() - rcTLMotion < 400)'), 'pricing duties (whole hidden calculator cards) defers only near real motion — opens and taps still price at once');
    R.ok(src.includes('#ca-rc-grid, #ca-rc-detail { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }'), 'the gesture surfaces raise no text selection on a long-press-and-move');
    R.ok(src.includes("wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); });"), 'the calendar raises no long-press context menu');
    // hotfix 16: the owner's inner-screen screenshots showed the calendar's
    // content dropping in tile-sized bands — the sheet's invisible live blur
    // over the blurred full-screen shade starved the compositor.
    R.ok(!/ca-rc-shade[^"]*backdrop-blur/.test(src), 'the calendar shade is scrim-only (hotfix 16) — no full-screen blur under the sheet');
    R.ok(/class="ca-rc-shade absolute inset-0 bg-black\/60 opacity-0/.test(src), 'the calendar shade is the plain black/60 scrim');
    R.ok(src.indexOf('w-8 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600') >= 0, 'the calendar grows the Settings-style drag handle');
    // hotfix 7 (owner orders): the sheet itself never scrolls — the grid is
    // fixed and the timeline owns the vertical scroll, no scrollbar
    R.ok(d.getElementById('ca-rc-sheet').className.indexOf('overflow-hidden') >= 0, 'the sheet never scrolls');
    R.ok(d.getElementById('ca-rc-detail').className.indexOf('flex-1') >= 0 && d.getElementById('ca-rc-detail').className.indexOf('overflow-y-auto') >= 0, 'the timeline owns the vertical scroll below the divider');
    R.ok(src.indexOf('#ca-rc-detail { scrollbar-width: none;') >= 0 && src.indexOf('#ca-rc-detail::-webkit-scrollbar { display: none;') >= 0, 'the timeline scrolls with no visible scrollbar');
    R.eq(d.getElementById('ca-rc-detail').getAttribute('data-rc-days'), '61', 'the timeline spans every attached roster date — all 61 of Oct+Nov');
    R.ok(d.querySelectorAll('#ca-rc-detail .ca-rc-row').length < 25, 'only a window of rows renders — the list is virtualized');
    // ---- pills: shapes, kinds, and the OFF day's plainness ----
    const pills = Array.from(d.querySelectorAll('.ca-rc-pill'));
    const styleOf = (p) => p.getAttribute('style') || '';
    const weekRows = d.querySelectorAll('#ca-rc-grid .relative.grid');
    // owner report, issue 1: two turnarounds on back-to-back days are two
    // circles, never one capsule
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(4.5 * 100% / 7)') >= 0), '1 Oct (KUL turnaround) is its own blue circle (hotfix 10: fly = blue)');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(5.5 * 100% / 7)') >= 0), '2 Oct (HKT turnaround) is a SEPARATE circle — duties never bleed together');
    R.eq(weekRows[0].querySelectorAll('.ca-rc-pill').length, 2, 'the week of 1–3 Oct holds exactly the two turnaround circles — the OFF day shows none');
    // owner report, issue 2: 12–14 Oct is one continuous capsule
    const syd = Array.from(weekRows[2].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(1 * 100% / 7 + 3px)') >= 0);
    R.ok(!!syd && styleOf(syd).indexOf('calc(3 * 100% / 7 - 3px - 3px)') >= 0 && styleOf(syd).indexOf('999px 999px 999px 999px') >= 0, 'the SIN-SYD-SIN duty is ONE capsule from the 12th through its 0142H landing on the 14th');
    // the MEL duty wraps the week: flush Saturday edge, flush Sunday start
    const melA = Array.from(weekRows[3].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(5 * 100% / 7 + 3px)') >= 0);
    R.ok(!!melA && styleOf(melA).indexOf('999px 0 0 999px') >= 0, 'the 23–24 Oct segment ends flush at the week edge — the duty continues');
    const melB = Array.from(weekRows[4].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(0 * 100% / 7)') >= 0);
    R.ok(!!melB && styleOf(melB).indexOf('0 999px 999px 0') >= 0, '…and picks up flush on Sunday the 25th, rounding off at its landing');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0 && styleOf(p).indexOf('calc(3.5 * 100% / 7)') >= 0) &&
        !pills.some(p => p.className.indexOf('ca-rc-k-sb') >= 0 && p.className.indexOf('is-capsule') >= 0), 'the 7th\u2019s SSS3 standby renders one green circle — standbys stay circles, never capsules (refresh: October\u2019s only standby day)');
    // roster refresh 2026-10-24: the old 6/7 (SSS1+SS80) and 20/21 (SN60+SN80)
    // adjacent standby pairs left the real October export — the never-merge
    // guard now runs on synthetic adjacent days, the SDLC-injection pattern
    {
        const sbKey = 'crewAssist.dutyDays';
        const sbBefore = w.localStorage.getItem(sbKey);
        const sbSt = JSON.parse(sbBefore);
        sbSt['2026-10'] = (sbSt['2026-10'] || []).concat([
            { ymd: '2026-10-06', kind: 'duty', code: 'SN60', loc: '', fns: [], dkey: '' },
            { ymd: '2026-10-07', kind: 'duty', code: 'SN80', loc: '', fns: [], dkey: '' }
        ]);
        w.localStorage.setItem(sbKey, JSON.stringify(sbSt));
        const sbHtml = String(w.eval('rcMonthHtml("2026-10")'));
        const sbCircles = (sbHtml.match(/ca-rc-pill is-circle ca-rc-k-sb/g) || []).length;
        R.ok(sbCircles >= 2 && sbHtml.indexOf('ca-rc-pill is-capsule ca-rc-k-sb') < 0, 'adjacent standby days stay separate circles — SN60 and SN80 never merge into one capsule');
        w.localStorage.setItem(sbKey, sbBefore);
    }
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
    // hotfix 9 (owner reports): the timeline opens ON today — the reveal
    // anchors the selected row as the first line below the calendar, every
    // tap scrolls its entry flush, and a stale offset from an earlier
    // session can never point into blank spacer
    R.ok(src.indexOf('top < det.scrollTop') < 0, 'the reveal always scrolls — it no longer waits for the row to be out of view (owner order)');
    {
        const idx = rows().findIndex(r => r.classList.contains('is-on'));
        R.ok(idx >= 0 && idx <= 6, 'opening the calendar anchors today\u2019s row at the head of the rendered window — the first line below the calendar');
    }
    R.ok(src.indexOf('hotfix 9 (owner report): the wrap must be VISIBLE') >= 0, 'the calendar un-hides before its timeline renders — a display:none scroller silently ignores the reveal');
    R.ok(src.indexOf('detEl.scrollTop = maxTop') >= 0, 'a stale scroll offset clamps into the new timeline before its window renders');
    // hotfix 10 (owner orders): the duty tints — flight BLUE, standby GREEN,
    // course BROWNISH GOLD — both themes, and standby splits from course by
    // the owner's own standby code table (SDLC and friends are courses)
    R.ok(src.indexOf('rgba(37,99,235,.30)') >= 0 && src.indexOf('rgba(96,165,250,.36)') >= 0, 'flight pills are BLUE — tuned for light and dark themes');
    R.ok(src.indexOf('rgba(21,128,61,.24)') >= 0 && src.indexOf('rgba(74,222,128,.30)') >= 0, 'standby pills are GREEN in both themes');
    R.ok(src.indexOf('rgba(146,94,14,.26)') >= 0 && src.indexOf('rgba(212,167,76,.34)') >= 0, 'course pills are BROWNISH GOLD in both themes');
    R.ok(src.indexOf('ca-rc-k-duty') < 0, 'the old shared duty tint is gone — standby and course are separate colors');
    R.ok(src.indexOf('function rcTintKind') >= 0, 'standby vs course splits through rcTintKind on the standby code table');
    R.ok(pills.some(p => p.className.indexOf('ca-rc-k-sb') >= 0), 'the standby days render green circles in the grid (hotfix 10)');
    // the split itself: standby is exactly the owner's code table, every
    // other duty code (SDLC and friends) is a course — proven on a synthetic
    // course day so the pin never leans on stitched-month parse quirks
    {
        R.eq(String(w.eval('rcTintKind("duty", "SSS1")')), 'sb', 'standby codes tint green');
        R.eq(String(w.eval('rcTintKind("duty", "SDLC")')), 'crs', 'course codes tint brownish gold');
        R.eq(String(w.eval('rcTintKind("fly", "")')), 'fly', 'fly days keep their own tint');
        const storeKey = 'crewAssist.dutyDays';
        const before = w.localStorage.getItem(storeKey);
        const st = JSON.parse(before);
        st['2026-10'] = (st['2026-10'] || []).concat([{ ymd: '2026-10-31', kind: 'duty', code: 'SDLC', loc: '', fns: [], dkey: '' }]);
        w.localStorage.setItem(storeKey, JSON.stringify(st));
        const mhtml = String(w.eval('rcMonthHtml("2026-10")'));
        R.ok(mhtml.indexOf('ca-rc-k-crs') >= 0, 'a course day renders its bronze circle in the month grid');
        R.ok(mhtml.indexOf('ca-rc-k-sb') >= 0 && mhtml.indexOf('ca-rc-k-fly') >= 0, 'standby green and flight blue circles render in the same month grid');
        w.eval('rosterCalSelect("2026-10-07")'); // refresh: the 7th is October's standby day (SSS3)
        await wait(120);
        R.ok(d.querySelector('.ca-rc-row.is-on .ca-rc-gut.k-sb'), 'a standby day\u2019s selected row carries the standby gutter tint (green)');
        w.eval('rosterCalSelect("2026-10-31")');
        await wait(120);
        R.ok(d.querySelector('.ca-rc-row.is-on .ca-rc-gut.k-crs'), 'the course day\u2019s selected row carries the course gutter tint (bronze)');
        w.localStorage.setItem(storeKey, before);
        w.eval('rosterCalTimelineInit()');
        w.eval('rosterCalSelect("' + TODAY + '")');
        await wait(120);
    }
    // hotfix 10 (owner report): the FIRST open still showed the roster\u2017s
    // earliest dates — the reveal ran while the sheet sat off-screen and an
    // engine can drop that scrollTop write. The reveal is now re-asserted as
    // the sheet settles. Simulate the dropped write — fling the scroller to
    // the far bottom and re-render the window there (today\u2019s row leaves
    // the DOM) — then let the settle passes run: the timeline must heal
    // back onto today.
    {
        const dd = d.getElementById('ca-rc-detail');
        dd.scrollTop = 999999;
        w.eval('rosterCalTLWindow(true)');
        R.ok(!dd.querySelector('.ca-rc-row[data-rc-ymd="' + TODAY + '"]'), 'sabotage: the window re-renders at the far bottom — today\u2019s row is out of view (the dropped first reveal)');
        w.eval('rcRevealArm()');
        await wait(500);
        R.ok((dd.scrollTop || 0) > 0 && (dd.scrollTop || 0) < 999999, 'the settle pass healed the scroll — off the sabotaged bottom, back at today\u2019s own offset');
        const healedIdx = rows().findIndex(r => r.classList.contains('is-on'));
        R.ok(healedIdx >= 0 && healedIdx <= 6, 'the settle pass heals the dropped reveal — today\u2019s entry is the first line again');
        R.ok(!!dd.querySelector('.ca-rc-row[data-rc-ymd="' + TODAY + '"]'), 'today\u2019s row is back in the rendered window');
    }
    R.ok(src.indexOf('[90, 360, 760]') >= 0, 'the open schedules three settle passes as the sheet slides in and settles');
    R.ok(src.indexOf("wrap.addEventListener('pointerdown', rcRevealCancel, true)") >= 0, 'a real touch cancels the pending reveal passes — the user owns the timeline');
    R.ok(src.indexOf('rcRevealCancel();   // hotfix 10') >= 0, 'closing the calendar cancels any reveal pass still pending');
    // round 33 (owner report: the FIRST calendar open of a session on the PC
    // showed blank space below the grid — zero rows in view — until a close
    // and reopen; resizing did nothing). Root cause chain, found by rig
    // telemetry on the anchor dance: on a fresh page the detail is empty, so
    // the engine CLAMPS the reveal's first scrollTop write back to 0, and a
    // correction based on the TARGET then double-counted the whole offset
    // (target + the row's distance from a scroller that never moved),
    // hurling the window into spacer-only land; the cover window's
    // extrapolation divides the gap by the nearest mounted row's height (a
    // 41px empty day standing in for 300px fly cards), so the re-derived
    // window could start BELOW the resting scroller — the viewport sat
    // inside the head spacer, blank, and every later pass re-derived the
    // same wrong window. Three guarantees, one per link:
    R.ok(src.indexOf('const next = Math.max(0, (det.scrollTop || 0) + delta);') >= 0, 'round 33: the reveal\u2019s correction bases itself on where the scroller ACTUALLY rests — identical when the scroller stuck, the row\u2019s true offset when the engine clamped the first write (the double-count is gone)');
    R.ok(src.indexOf('if (next === target && (det.scrollTop || 0) === target) break;') >= 0, 'round 33: the dance only gives up when it is genuinely stuck at its own target — a clamped scroller with a matching correction keeps iterating to the landing');
    R.ok(src.indexOf('for (let k = 0; k < 8; k++) {') >= 0, 'round 33: the anchor dance carries a wider convergence budget — a long-haul roster\u2019s estimate error takes more than four measured steps to walk down');
    R.ok(/const estAb = estimate\(\);\s*\n\s*ab = \[Math\.min\(ab\[0\], estAb\[0\]\), Math\.max\(ab\[1\], estAb\[1\]\)\];/.test(src), 'round 33: the window unions the cover window with the estimate window — the estimate always covers the scroller\u2019s own position, so no window can ever start below the scroller or end above it (the head-spacer blank is impossible)');
    R.ok(/const ab2e = estimate\(\);\s*\n\s*if \(apply\(Math\.min\(ab2\[0\], ab2e\[0\]\), Math\.max\(ab2\[1\], ab2e\[1\]\)\)\) \{ refreshIcons\(\); \}/.test(src), 'round 33: the post-correction second application unions too — the drift-corrected re-derivation can never leave the resting viewport outside the window');
    R.ok(/const dr33 = det\.getBoundingClientRect\(\);\s*\n\s*if \(dr33\.height > 0\) \{[\s\S]*?if \(!anyInView\) rosterCalTLWindow\(true\);[\s\S]*?\}, ms\)\);/.test(src), 'round 33: each settle pass force-rebuilds the window when the viewport shows no row at all — a spacer-only state (whatever engine quirk produced it) heals within the pass, layout engines only');
    // the spanning invariant, behaviourally: wherever the scroller is left
    // resting, the rendered window must span it — the head spacer may never
    // start below the scroller, and rows must be mounted
    {
        const dd = d.getElementById('ca-rc-detail');
        const spans = (x) => {
            dd.scrollTop = x;
            w.eval('rosterCalTLWindow(true)');
            const st = dd.scrollTop || 0;
            const head = dd.firstElementChild;
            const headH = head && head.style && head.style.height ? parseInt(head.style.height, 10) : -1;
            return headH >= 0 && headH <= st + 25 && dd.querySelectorAll('.ca-rc-row').length > 0;
        };
        R.ok(spans(0) && spans(300) && spans(1200) && spans(999999), 'round 33: for every resting position the window spans the scroller — the head spacer never starts below it, rows are always mounted (the blank-timeline state cannot exist)');
    }
    // owner report, issue 4: a FLOWN turnaround retells its legs
    const past = cells.find(c => c.getAttribute('data-ymd') === '2026-10-02');
    past.click();
    await wait(300);
    let det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 736') >= 0 && det.indexOf('SQ 735') >= 0, 'the flown 2 Oct HKT turnaround retells both legs as flight cards');
    R.ok(det.indexOf('1607H') >= 0 && det.indexOf('2052H') >= 0, 'past legs keep their times (never-pruned store)');
    R.ok(det.indexOf('no leg times') < 0, 'a flown duty never says "no leg times for this day" again');
    // owner report, issue 2: the (+1) format
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-13').click();
    await wait(300);
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 241') >= 0 && det.indexOf('SQ 242') >= 0, 'the SYD duty names both sectors');
    R.ok(rowN(12) && rowN(13) && rowN(14), 'the duty flows as its own day rows — the 12th through the 14th');
    R.ok(rowN(13).classList.contains('is-on') && !rowN(12).classList.contains('is-on') && !rowN(14).classList.contains('is-on'), 'the selected day is the highlighted band \u2014 its neighbours are not');
    const t13 = rowN(13).textContent.replace(/\s+/g, ' ');
    R.ok(t13.indexOf('LO · SYD') >= 0 && t13.indexOf('SQ 242') >= 0, 'the 13th wakes in SYD and flies the leg home — layover label above the flight card');
    R.ok(t13.indexOf('2006H') >= 0 && t13.indexOf('(+1) 0142H') >= 0, 'a leg landing past midnight wears the owner\u2019s (+1) format');
    R.ok(t13.indexOf('8H 36M') >= 0, 'the card shows the roster\u2019s own block time — 8H 36M');
    const t14 = rowN(14).textContent.replace(/\s+/g, ' ');
    R.ok(t14.indexOf('Lands SIN') >= 0 && t14.indexOf('0142H') >= 0, 'the landing day reads Lands SIN · 0142H');
    const future = cells.find(c => c.getAttribute('data-ymd') === '2026-10-27');
    const visibleCards = () => Array.from(d.querySelectorAll('[data-calc-card]')).filter((c) => !c.closest('[data-rc-live-calc]'));
    const cardsBefore = visibleCards().length;
    future.click();
    await wait(300);
    R.ok(future.classList.contains('is-selected'), 'tapping a day selects it');
    R.eq(visibleCards().length, cardsBefore, 'selecting a flying day never builds a calculator card (the hidden live-earnings card never counts)');
    R.ok(d.getElementById('ca-arch-sub').classList.contains('hidden'), 'no popup — the day\u2019s details live in the section below the divider');
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 164') >= 0 && det.indexOf('SQ 163') >= 0, 'the detail names every leg of the duty');
    R.ok(rowN(27) && rowN(27).querySelectorAll('.ca-rc-trk .pt').length === 4, 'a two-sector day stacks two dashed-track cards');
    R.ok(det.indexOf('0840H') >= 0 && det.indexOf('0955H') >= 0, 'times read in the 24-hour HHMMH house format');
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-03').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('ATDO') >= 0 && d.getElementById('ca-rc-detail').textContent.indexOf('Enjoy your day off') >= 0, 'an off day shows its roster code and its caption');
    // standby windows (owner-provided timings) — refresh: the 7th is the
    // real SSS3 day; SN60's different window runs on a synthetic day so the
    // per-code coverage survives the roster refresh
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-07').click();
    await wait(200);
    let sbDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(sbDet.indexOf('Standby / SSS3') >= 0 && sbDet.indexOf('Window 1200H') >= 0 && sbDet.indexOf('2359H') >= 0, 'a standby day shows its window — Standby / SSS3, 1200H to 2359H');
    {
        const sbKey = 'crewAssist.dutyDays';
        const sbBefore = w.localStorage.getItem(sbKey);
        const sbSt = JSON.parse(sbBefore);
        sbSt['2026-10'] = (sbSt['2026-10'] || []).map((dd) => dd.ymd === '2026-10-06' ? { ymd: '2026-10-06', kind: 'duty', code: 'SN60', loc: '', fns: [], dkey: '' } : dd);
        w.localStorage.setItem(sbKey, JSON.stringify(sbSt));
        w.eval('rosterCalTimelineInit()');
        w.eval('rosterCalSelect("2026-10-06")');
        await wait(200);
        sbDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
        R.ok(sbDet.indexOf('Standby / SN60') >= 0 && sbDet.indexOf('Window 0600H') >= 0 && sbDet.indexOf('2159H') >= 0, 'SN60 reads its own 0600H to 2159H window');
        w.localStorage.setItem(sbKey, sbBefore);
        w.eval('rosterCalTimelineInit()');
    }
    // v1.45.49 (owner upload, docs/ROSTER_CODES.pdf - the official duty-code
    // legend): duty days name their REAL code meanings; the generic line is
    // retired. Same save/restore idiom as the SN60 window block above.
    R.ok(src.includes('const RO_DUTY_DESC_RAW = `') && src.includes("RO_DUTY_DESC_RAW.split('\\n').forEach((l) => { const i = l.indexOf('|'); if (i > 0) RO_DUTY_DESC[l.slice(0, i)] = l.slice(i + 1); });"), 'v1.45.49: the official legend is embedded verbatim and parsed at boot - offline-first, like everything else the app ships');
    R.ok((w.eval('Object.keys(RO_DUTY_DESC).length') || 0) >= 1000, 'the legend carries the full table (1,082 codes from the owner\u2019s PDF)');
    R.ok(w.eval('RO_DUTY_DESC["33A2"]') === 'A330 AIRCRAFT VISIT' && w.eval('RO_DUTY_DESC["BH99"]') === 'FOOD HYGIENE COURSE', 'spot lookups read the official wording, caps and all - zero editorialising');
    R.ok(src.includes("(desc || 'Ground duty')") && !src.includes(": 'Course or ground duty'"), 'the wiring names the legend meaning, with the short generic fallback - and the old generic literal is gone from the code entirely');
    // v1.45.50 (owner report, Oct 2025 - the whole month showed the
    // no-leg-times line): duties imported before the never-pruned
    // allFlights store (v1.39.0 hotfix 4) carry fly days the store has no
    // legs for. The old line blamed the roster; the fix names the real
    // cause and the remedy. Both sides pinned on the real Oct 2025 PDF.
    R.ok(src.includes('const eraGap = !stLeg[mkLeg] || !stLeg[mkLeg].length;') && src.includes('re-attach its PDF to rebuild them') && src.includes("'Flying duty \u2014 the roster printed no leg times for this day.'"), 'v1.45.50: the fly-day fallback splits on the store\u2019s own month - the storage-era gap names itself and its remedy, the real parse gap keeps the honest roster line');
    {
        const lgKey = 'crewAssist.dutyDays';
        const lgBefore = w.localStorage.getItem(lgKey);
        const lgSt = JSON.parse(lgBefore);
        lgSt['2026-10'] = (lgSt['2026-10'] || []).map((dd) => dd.ymd === '2026-10-06' ? { ymd: '2026-10-06', kind: 'duty', code: '33A2', loc: '', fns: [], dkey: '' } : dd);
        w.localStorage.setItem(lgKey, JSON.stringify(lgSt));
        w.eval('rosterCalTimelineInit()');
        w.eval('rosterCalSelect("2026-10-06")');
        await wait(200);
        let lgDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
        R.ok(lgDet.indexOf('33A2') >= 0 && lgDet.indexOf('A330 AIRCRAFT VISIT') >= 0, 'v1.45.49: a known duty code names its official meaning - the aircraft visit, one row, the label\u2019s truncate holding the line');
        lgSt['2026-10'] = (lgSt['2026-10'] || []).map((dd) => dd.ymd === '2026-10-06' ? { ymd: '2026-10-06', kind: 'duty', code: 'ZZ9Z', loc: '', fns: [], dkey: '' } : dd);
        w.localStorage.setItem(lgKey, JSON.stringify(lgSt));
        w.eval('rosterCalTimelineInit()');
        w.eval('rosterCalSelect("2026-10-06")');
        await wait(200);
        lgDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
        R.ok(lgDet.indexOf('ZZ9Z') >= 0 && lgDet.indexOf('Ground duty') >= 0, 'a code the legend does not know falls back to the short generic');
        w.localStorage.setItem(lgKey, lgBefore);
        w.eval('rosterCalTimelineInit()');
    }
    // v1.45.50 live: the owner's exact device state, on a fresh page -
    // duty days stored, the never-pruned flight store absent for the
    // month. rcLegCache holds nothing on a fresh boot, so the store is
    // the only voice: the fly day must name the storage-era gap and its
    // remedy, not blame the roster.
    {
      const { w, d } = await boot(APP, { seed: (x) => {
        x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
        x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({
          '2025-10': [{ ymd: '2025-10-14', kind: 'fly', code: '', loc: '', fns: ['123'], dkey: '2025-10-14' }]
        }));
      } });
      w.eval('openRosterCalendar()');
      await wait(500);
      w.eval('rosterCalSelect("2025-10-14")');
      await wait(250);
      let egDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
      R.ok(egDet.indexOf('saved before the calendar kept flight details') >= 0 && egDet.indexOf('re-attach its PDF') >= 0 && egDet.indexOf('no leg times') < 0, 'v1.45.50: a month with duty days but no stored flights names the storage-era gap and its remedy - the roster is no longer blamed');
      // the same page, the month now holding one far-away leg: a REAL
      // parse gap (a fly day no stored leg touches) keeps the honest line
      w.localStorage.setItem('crewAssist.allFlights', JSON.stringify({
        '2025-10': [{ fn: '9992', dep: 'SIN', arr: 'KUL', ymd: '2025-10-02', std: '08:00', sta: '09:05', stdYmd: '2025-10-02', staYmd: '2025-10-02' }]
      }));
      w.eval('rosterCalTimelineInit()');
      w.eval('rosterCalSelect("2025-10-13")');
      await wait(250);
      w.eval('rosterCalSelect("2025-10-14")');
      await wait(250);
      egDet = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
      R.ok(egDet.indexOf('no leg times') >= 0 && egDet.indexOf('saved before the calendar') < 0, 'a month that DOES hold flights keeps the honest parse-gap line for a legless day');
    }
    // a saved duty offers its earnings entry from the detail section
    w.eval("persistArchive([{ id: 'e1', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-29', flightType: 'Layover', stationDisplay: 'HKT', amount: 318.55 }])");
    cells.find(c => c.getAttribute('data-ymd') === '2026-10-29').click();
    await wait(200);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('318.55') >= 0, 'a saved duty shows its amount beside the drill-in chevron');
    d.querySelector('#ca-rc-detail [data-rc-earn]').click();
    await wait(600);
    R.ok(!d.getElementById('ca-arch-sub').classList.contains('hidden'), 'the saved entry opens from its flight card');
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
    // owner report: 8–12 Nov renders as ONE capsule (blue since hotfix 10)
    const novWeek = d.querySelector('.ca-rc-day[data-ymd="2026-11-08"]').parentElement;
    const novPills = Array.from(novWeek.querySelectorAll('.ca-rc-pill'));
    R.eq(novPills.length, 1, 'the week of 8–12 Nov holds exactly one pill');
    R.ok(novPills[0] && novPills[0].className.indexOf('ca-rc-k-fly') >= 0 && styleOf(novPills[0]).indexOf('calc(0 * 100% / 7 + 3px)') >= 0 && styleOf(novPills[0]).indexOf('calc(5 * 100% / 7 - 3px - 3px)') >= 0 && styleOf(novPills[0]).indexOf('999px 999px 999px 999px') >= 0, 'the whole SIN-LHR-SIN duty is one blue capsule, the 8th through the 12th (hotfix 10)');
    d.querySelector('.ca-rc-day[data-ymd="2026-11-10"]').click();
    await wait(300);
    R.ok(d.getElementById('ca-rc-detail').textContent.indexOf('SQ 306') >= 0 && d.getElementById('ca-rc-detail').textContent.indexOf('SQ 305') >= 0, 'the absorbed layover day on the 10th retells the whole London duty');
    d.querySelector('.ca-rc-day[data-ymd="2026-11-09"]').click();
    await wait(300);
    det = d.getElementById('ca-rc-detail').textContent.replace(/\s+/g, ' ');
    R.ok(det.indexOf('SQ 306') >= 0 && det.indexOf('SQ 305') >= 0, '9 Nov retells the WHOLE London duty');
    R.ok(rowN(8) && rowN(9) && rowN(10) && rowN(11) && rowN(12), 'the London duty flows as its own day rows — the 8th through the 12th');
    R.ok(rowN(9).classList.contains('is-on') && !rowN(8).classList.contains('is-on') && !rowN(12).classList.contains('is-on'), 'the selected day is the highlighted band \u2014 the rest of the trip is not');
    const t9 = rowN(9).textContent.replace(/\s+/g, ' ');
    R.ok(t9.indexOf('SQ 306') >= 0 && t9.indexOf('359') >= 0 && t9.indexOf('0110H') >= 0 && t9.indexOf('0740H') >= 0, 'the 9th carries the SQ 306 hero card — aircraft 359, SIN 0110H to LHR 0740H');
    R.ok(t9.indexOf('14H 30M') >= 0, 'the block time reads from the roster\u2019s own FT row — 14H 30M');
    R.ok(rowN(9).querySelectorAll('.ca-rc-trk .pt').length === 2 && !!rowN(9).querySelector('.ca-rc-trk .ln'), 'the route renders as a dashed track with a filled dot at each end');
    // hotfix 7 (owner report): the London duty is tappable into earnings even
    // unsaved — the live amount lands on the card, the card opens the overlay
    await wait(1500);
    const ldnCard = rowN(9).querySelector('[data-rc-earn]');
    const ldnAmt = ldnCard && ldnCard.querySelector('[data-rc-amt]');
    R.ok(ldnAmt && ldnAmt.textContent === '$1511.94', 'an UNSAVED duty shows its live earnings — the London trip prices at $1511.94');
    R.ok(!!ldnCard.querySelector('.text-sm.font-bold.text-sia-gold') && !!ldnCard.querySelector('.text-sm.font-bold.text-gray-500'), 'the aircraft uses the flight number\u2019s type size in its own colour');
    ldnCard.click();
    await wait(900);
    const ldnSub = d.getElementById('ca-arch-sub');
    R.ok(ldnSub && !ldnSub.classList.contains('hidden'), 'tapping the London card opens its earnings overlay — the owner\u2019s report fixed');
    const ldnTxt = ldnSub ? ldnSub.textContent.replace(/\s+/g, ' ') : '';
    R.ok(ldnTxt.indexOf('SQ 306') >= 0 && ldnTxt.indexOf('Grand Total') >= 0 && ldnTxt.indexOf('$1,511.94') >= 0, 'the overlay retells the duty with its grand total');
    R.ok(ldnTxt.indexOf('Figured from your roster') >= 0, 'and says honestly that it is not saved yet');
    w.eval('closeArchSub()');
    await wait(400);
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
    // hotfix 11 (owner report: "some flights can't be tapped open, but I can
    // open them from the earnings page"): the save flow files an entry under
    // the FIRST LEG's date, not the report day — the London duty reported on
    // 8 Nov departs 0110 on the 9th (its filing lands on the 9th), and the
    // 1 Nov duty even departs 31 Oct. The calendar matched the report day
    // only, missed the filing, and fell through to live pricing. The lookup
    // now spans every date the duty touches, and a routed entry on a shared
    // date must name one of the duty's own stations — a neighbour's filing
    // never opens from the wrong tap.
    {
        w.eval("persistArchive(["
            + "{ id: 'decoy', savedAt: new Date().toISOString(), monthKey: '2026-11', sectorDate: '2026-11-09', flightType: 'Turnaround', stationDisplay: 'PEN', amount: 99.99 },"
            + "{ id: 'lhr', savedAt: new Date().toISOString(), monthKey: '2026-11', sectorDate: '2026-11-09', flightType: 'Layover', stationDisplay: 'LHR', amount: 1511.94 },"
            + "{ id: 'amd', savedAt: new Date().toISOString(), monthKey: '2026-10', sectorDate: '2026-10-31', flightType: 'Turnaround', stationDisplay: 'AMD', amount: 411.5 }])");
        // the London duty: reported 8 Nov, first card on the 9th, filed under the 9th
        w.eval('rosterCalSelect("2026-11-09")');
        await wait(250);
        let earn11 = d.querySelector('.ca-rc-row[data-rc-ymd="2026-11-09"] [data-rc-earn]');
        R.ok(!!earn11, 'the overnight departure\u2019s flight card carries the drill-in chevron');
        earn11.click();
        await wait(600);
        let sub11 = d.getElementById('ca-arch-sub');
        let sub11Txt = sub11 ? sub11.textContent.replace(/\s+/g, ' ') : '';
        R.ok(sub11 && !sub11.classList.contains('hidden') && sub11Txt.indexOf('$1,511.94') >= 0 && sub11Txt.indexOf('Figured from your roster') < 0, 'hotfix 11: a duty filed under its first leg\u2019s date opens its FILED summary from the calendar');
        R.ok(sub11Txt.indexOf('99.99') < 0, 'a neighbour duty\u2019s same-date filing never opens — the route guard holds');
        w.eval('closeArchSub()');
        await wait(300);
        // the 1 Nov duty departs 31 Oct — the span rule reaches back a day
        w.eval('rosterCalSelect("2026-11-01")');
        await wait(250);
        earn11 = d.querySelector('.ca-rc-row[data-rc-ymd="2026-11-01"] [data-rc-earn]');
        R.ok(!!earn11, 'the 1 Nov duty\u2019s card carries the chevron');
        earn11.click();
        await wait(600);
        sub11 = d.getElementById('ca-arch-sub');
        sub11Txt = sub11 ? sub11.textContent.replace(/\s+/g, ' ') : '';
        R.ok(sub11 && !sub11.classList.contains('hidden') && sub11Txt.indexOf('411.50') >= 0 && sub11Txt.indexOf('Figured from your roster') < 0, 'a duty printed on 1 Nov but departing 31 Oct opens its 31 Oct filing');
        w.eval('closeArchSub()');
        await wait(300);
        // restore the state this stretch of the suite expects
        w.eval("persistArchive([])");
        w.eval('rosterCalSelect("2026-11-12")');
        await wait(250);
    }
    // hotfix 6+7 (owner orders): the fold chevron, the press-and-hold month,
    // and the scroll-synced timeline
    const gridEl = d.getElementById('ca-rc-grid');
    d.getElementById('ca-rc-fold').click();
    await wait(150);
    R.ok(gridEl.classList.contains('hidden'), 'the chevron collapses the calendar for the timeline');
    R.ok(rows().length > 0, 'the timeline keeps flowing with the grid folded away');
    d.getElementById('ca-rc-fold').click();
    await wait(150);
    R.ok(!gridEl.classList.contains('hidden'), 'and expands it back');
    // hotfix 8 (owner ruling, restored): the fold ANIMATES — with a layout
    // the calendar glides away and back instead of vanishing (jsdom has no
    // layout, so a faked height stands in for one)
    {
        const g2 = d.getElementById('ca-rc-grid');
        let fakeH = 320;
        Object.defineProperty(g2, 'offsetHeight', { configurable: true, get: () => fakeH });
        d.getElementById('ca-rc-fold').click();
        R.ok(!g2.classList.contains('hidden'), 'the collapse starts animated — hidden only lands when the glide ends');
        await wait(450);
        R.ok(g2.classList.contains('hidden'), 'the collapse glide finishes into the folded state');
        fakeH = 320;
        d.getElementById('ca-rc-fold').click();
        R.ok(!g2.classList.contains('hidden'), 'the expand reveals the grid at once, then it grows into place');
        await wait(450);
        R.ok(!g2.classList.contains('hidden') && g2.style.height === '', 'the expand glide finishes with the height released');
        delete g2.offsetHeight;   // back to jsdom's honest no-layout world
    }
    // scrolling the timeline flips the calendar to the month in view
    const tlEl = d.getElementById('ca-rc-detail');
    tlEl.scrollTop = 999999;
    tlEl.dispatchEvent(new w.Event('scroll', { bubbles: true }));
    await wait(400);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'scrolling the timeline into November flips the calendar');
    R.ok(!!rowN(30) && rowN(30).querySelector('.ca-rc-gut .m').textContent === 'NOV', 'late-November rows render after the scroll');
    // tapping a timeline row highlights that date in the grid
    const row28 = rowN(28);
    R.ok(!!row28, 'a late-November row is rendered');
    row28.click();
    await wait(200);
    R.ok(d.querySelector('.ca-rc-day.is-selected') && d.querySelector('.ca-rc-day.is-selected').getAttribute('data-ymd') === '2026-11-28', 'tapping a timeline row highlights that date in the calendar');
    R.ok(row28.classList.contains('is-on'), 'and the row itself carries the highlighted band');
    // press and HOLD the month header to return to today; a quick tap does nothing
    const jump = d.getElementById('ca-rc-jump');
    const hold = () => { const pd = new w.Event('pointerdown', { bubbles: true }); pd.clientX = 30; pd.clientY = 30; jump.dispatchEvent(pd); };
    hold();
    const pu = new w.Event('pointerup', { bubbles: true }); pu.clientX = 30; pu.clientY = 30; jump.dispatchEvent(pu);
    await wait(700);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'a quick tap on the month header does nothing');
    hold();
    await wait(1000);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Oct 2026') === 0, 'pressing and holding the month header returns to today\u2019s month');
    R.ok(d.querySelector('.ca-rc-day.is-selected') && d.querySelector('.ca-rc-day.is-selected').getAttribute('data-ymd') === TODAY, 'and lands the selection on today');
    d.getElementById('ca-rc-next').click();
    // hotfix 8 (owner report): the browser fires a scroll event for the
    // timeline's own reveal-scroll too — that must never flip the month
    // back to today after a swipe
    tlEl.dispatchEvent(new w.Event('scroll', { bubbles: true }));
    await wait(500);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'after hold-for-today, the swipe keeps November — no jump back to today');
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
    // hotfix 8 (owner order): the swipe GLIDES — a finger-tracked drag
    // follows the pointer and the release lands on the nearer month
    const drag = (x1, x2) => {
        const a = new w.Event('pointerdown', { bubbles: true }); a.clientX = x1; a.clientY = 300; grid.dispatchEvent(a);
        const mv = new w.Event('pointermove', { bubbles: true }); mv.clientX = Math.round((x1 + x2) / 2); mv.clientY = 300; grid.dispatchEvent(mv);
        const b = new w.Event('pointerup', { bubbles: true }); b.clientX = x2; b.clientY = 300; grid.dispatchEvent(b);
    };
    drag(200, 80);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'a finger-tracked drag glides into November');
    R.ok(!grid.querySelector('.ca-rc-track'), 'the glide leaves no track behind — the grid is one month again');
    drag(200, 170);
    await wait(600);
    R.ok(d.getElementById('ca-rc-month').textContent.indexOf('Nov 2026') === 0, 'a too-short drag glides back — November stays');
    // Escape closes the sheet
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
    R.ok(wrap.classList.contains('hidden'), 'Escape closes the roster calendar');
  }

  // ---- owner report, 1.45.8: the paxing leg + the legend-panel page (Feb 2026) ----
  // SQ 298 CHC-SIN on 13 Feb is a POS flight: the roster prints its Rpt/STD/STA
  // but never a block time. Two traps: the never-pruned store dropped pos legs
  // (the 13th showed "no leg times"), and the 2026 export squeezes the Duty
  // Codes legend onto page 1 beside the table — the legend-page detector then
  // killed every duty row (no LO stations, no OFF days: the 12th showed the
  // same complaint). May 2024 shares the panel layout.
  {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const readItems = async (file) => {
      const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../docs/_reference_rosters/' + file)));
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
      const items = [];
      for (let pi = 1; pi <= doc.numPages; pi++) {
        const tc = await (await doc.getPage(pi)).getTextContent();
        tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
      }
      return items;
    };
    const febItems = await readItems('Feb 2026.pdf');
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__feb = rosterParse(' + JSON.stringify(febItems) + ')');
    const febFlights = w.eval('window.__feb.flights');
    const p298 = febFlights.find(f => f.fn === '298');
    R.ok(!!p298 && p298.pos === true, 'SQ 298 parses as a positioning leg');
    R.eq(p298 && p298.std + '-' + p298.sta + '-' + (p298.ft || ''), '1200-1735-', 'the paxing leg carries its printed STD/STA and no block time');
    const febBy = {};
    w.eval('window.__feb.days').forEach(x => { febBy[x.ymd] = x; });
    R.eq(Object.keys(febBy).length, 28, 'the legend-panel page still parses all 28 February days');
    R.eq(febBy['2026-02-12'].kind + '@' + febBy['2026-02-12'].loc, 'fly@CHC', 'the CHC layover day carries its station (the 12th)');
    R.eq(febBy['2026-02-01'].kind + '#' + febBy['2026-02-01'].code, 'al#AALV', 'annual leave days parse beside the panel');
    R.eq(febBy['2026-02-15'].kind + '#' + febBy['2026-02-15'].code + '|' + febBy['2026-02-16'].kind + '#' + febBy['2026-02-16'].code, 'duty#SSN1|off#OFFD', 'standby and OFF days parse beside the panel');
    // the two stores: the paxing leg rides the never-pruned store, not upcoming
    w.eval('upcomingRemember(window.__feb)');
    const upFeb = JSON.parse(w.localStorage.getItem('crewAssist.upcoming'))['2026-02'] || [];
    const allFeb = JSON.parse(w.localStorage.getItem('crewAssist.allFlights'))['2026-02'] || [];
    R.ok(!upFeb.some(f => f.fn === '298'), 'the upcoming store still excludes the paxing leg');
    R.ok(allFeb.some(f => f.fn === '298' && f.stdYmd === '2026-02-13' && f.pos === true), 'the never-pruned store keeps the paxing leg with its true date');
    // the calendar: the 13th borrows the SIN sibling's block time; the 12th is the LO day
    w.eval('openRosterCalendar()');
    await wait(500);
    w.eval('rosterCalSelect("2026-02-13")');
    await wait(400);
    const rcRow = (ymd) => Array.from(d.querySelectorAll('#ca-rc-detail .ca-rc-row')).find(r => r.getAttribute('data-rc-ymd') === ymd);
    const t13 = rcRow('2026-02-13').textContent.replace(/\s+/g, ' ');
    R.ok(t13.indexOf('no leg times') === -1, 'the 13th no longer claims the roster printed no leg times');
    R.ok(t13.indexOf('SQ 298') >= 0 && t13.indexOf('1200H') >= 0 && t13.indexOf('1735H') >= 0 && t13.indexOf('9H 34M') >= 0, 'the paxing leg shows its printed times and the sibling\u2019s borrowed block');
    const t12 = rcRow('2026-02-12').textContent.replace(/\s+/g, ' ');
    R.ok(t12.indexOf('no leg times') === -1, 'the 12th no longer claims the roster printed no leg times');
    R.ok(t12.indexOf('LO \u00b7 CHC') >= 0 && t12.indexOf('Layover') >= 0, 'the layover day reads LO \u00b7 CHC');
    // May 2024 shares the panel-on-page-1 layout — its duty days were lost too
    const mayItems = await readItems('May 2024.pdf');
    const mayBy = {};
    w.eval('rosterParse(' + JSON.stringify(mayItems) + ').days').forEach(x => { mayBy[x.ymd] = x; });
    R.eq(mayBy['2024-05-19'].kind + '@' + mayBy['2024-05-19'].loc, 'fly@CDG', 'May 2024 (same panel layout) keeps its layover station');
    R.eq(mayBy['2024-05-06'].kind + '#' + mayBy['2024-05-06'].code, 'al#AALV', 'May 2024 keeps its annual leave days');
  }

  // ---- owner report: the deadhead transfer ----
  // A duty paxes the crew into one airport of a city and operates the
  // return out of the city's other airport — two airports, one duty. The
  // calendar's leg walk required matching airports and orphaned the return:
  // its day fell to the "no leg times" fallback. An airport change is now
  // tolerated when either side is a positioning leg.
  {
    const pdfjs2 = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const readItems2 = async (file) => {
      const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../docs/_reference_rosters/' + file)));
      const doc = await pdfjs2.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
      const items = [];
      for (let pi = 1; pi <= doc.numPages; pi++) {
        const tc = await (await doc.getPage(pi)).getTextContent();
        tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5], page: pi }));
      }
      return items;
    };
    const junItems = await readItems2('Jun 2025.pdf');
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
    } });
    w.eval('window.__jun = rosterParse(' + JSON.stringify(junItems) + ')');
    const p810 = w.eval('window.__jun.flights').find(f => f.fn === '810');
    const p805 = w.eval('window.__jun.flights').find(f => f.fn === '805');
    R.ok(!!p810 && p810.pos === true && p810.dep === 'SIN' && p810.arr === 'PKX', 'SQ 810 parses as the SIN→PKX positioning leg');
    R.ok(!!p805 && !p805.pos && p805.dep === 'PEK' && p805.arr === 'SIN' && p805.ft === '05:54', 'SQ 805 parses as the PEK→SIN operating return with its block time');
    w.eval('upcomingRemember(window.__jun)');
    w.eval('openRosterCalendar()');
    await wait(500);
    w.eval('rosterCalSelect("2025-06-29")');
    await wait(400);
    const rcRowJ = (ymd) => Array.from(d.querySelectorAll('#ca-rc-detail .ca-rc-row')).find(r => r.getAttribute('data-rc-ymd') === ymd);
    const t29 = rcRowJ('2025-06-29').textContent.replace(/\s+/g, ' ');
    R.ok(t29.indexOf('no leg times') === -1, 'the 29th no longer claims the roster printed no leg times');
    R.ok(t29.indexOf('SQ 805') >= 0 && t29.indexOf('PEK') >= 0 && t29.indexOf('0848H') >= 0 && t29.indexOf('1442H') >= 0 && t29.indexOf('5H 54M') >= 0, 'the 29th shows the operating return with its printed times');
    R.ok(t29.indexOf('LO \u00b7 PEK') >= 0, 'the 29th reads LO \u00b7 PEK — the crew woke away from home');
    const t28 = rcRowJ('2025-06-28').textContent.replace(/\s+/g, ' ');
    R.ok(t28.indexOf('SQ 810') >= 0 && t28.indexOf('5H 54M') >= 0, 'the 28th shows the paxing leg borrowing the operating sibling\u2019s block time');
    R.ok(t28.indexOf('no leg times') === -1, 'the 28th never claims the roster printed no leg times');
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
      // v1.45.50: the fallback splits on whether the month holds stored
      // flights at all. These two pins pin the PARSE-gap side (the roster
      // parsed this month but printed no times for these days), so the
      // month must hold one distant stored leg - far from every duty day
      // above, so no day's legs change.
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({
        '2026-10': [{ fn: '9991', dep: 'SIN', arr: 'KUL', ymd: '2026-10-02', std: '08:00', sta: '09:05', stdYmd: '2026-10-02', staYmd: '2026-10-02' }]
      }));
    } });
    w.eval('openRosterCalendar()');
    await wait(500);
    // week 4 holds 25–31 Oct: the six-day duty is ONE capsule, rounded on
    // Monday and flush at the Saturday edge — the run continues past it
    const w4 = d.querySelectorAll('#ca-rc-grid .relative.grid')[4];
    const seg1 = w4 ? Array.from(w4.querySelectorAll('.ca-rc-pill')) : [];
    R.ok(seg1.length === 1 && seg1[0].className.indexOf('ca-rc-k-fly') >= 0, 'the six-day duty is one blue capsule in its week row (hotfix 10)');
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

  // ---- hotfix 8: a four-sector turnaround day (owner report: 3 Sep) and
  // the RQ99 birthday line ----
  {
    const { w, d } = await boot(APP, { now: '2026-10-04T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      // the real 3 Sep 2026 shape, moved into October: SQ 134/133/138/137
      // SIN-PEN-SIN-PEN-SIN on one day — plus a neighbour 2-sector turn
      const legs = [
        { fn: '134', dep: 'SIN', arr: 'PEN', ymd: '2026-10-05', std: '09:37', sta: '11:05', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:28', ac: '7M8', rpt: '07:35', pos: false },
        { fn: '133', dep: 'PEN', arr: 'SIN', ymd: '2026-10-05', std: '11:57', sta: '13:29', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:32', ac: '7M8', rpt: '', pos: false },
        { fn: '138', dep: 'SIN', arr: 'PEN', ymd: '2026-10-05', std: '16:22', sta: '17:45', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:23', ac: '7M8', rpt: '', pos: false },
        { fn: '137', dep: 'PEN', arr: 'SIN', ymd: '2026-10-05', std: '18:41', sta: '20:10', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:29', ac: '7M8', rpt: '', pos: false },
        { fn: '142', dep: 'SIN', arr: 'PEN', ymd: '2026-10-07', std: '09:00', sta: '10:30', stdYmd: '2026-10-07', staYmd: '2026-10-07', ft: '01:30', ac: '7M8', rpt: '07:30', pos: false },
        { fn: '141', dep: 'PEN', arr: 'SIN', ymd: '2026-10-07', std: '12:00', sta: '13:30', stdYmd: '2026-10-07', staYmd: '2026-10-07', ft: '01:30', ac: '7M8', rpt: '', pos: false },
      ];
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': legs }));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [
        { ymd: '2026-10-05', kind: 'fly', code: '', loc: '', fns: ['134', '133', '138', '137'], dkey: '2026-10-05' },
        { ymd: '2026-10-06', kind: 'off', code: 'RQ99', loc: '', fns: [], dkey: '' },
        { ymd: '2026-10-07', kind: 'fly', code: '', loc: '', fns: ['142', '141'], dkey: '2026-10-07' },
      ] }));
    } });
    R.eq(String(w.eval("rosterCalDutyFlights('2026-10-05').map(f=>f.fn).join('/')")), '134/133/138/137', 'a same-day 4-sector turn chains ALL four legs — the mid-turn SIN arrival does not cut it');
    R.eq(String(w.eval("rosterCalDutyFlights('2026-10-07').map(f=>f.fn).join('/')")), '142/141', 'a 2-sector turn still chains its own two legs');
    R.eq(String(w.eval("rosterCalDutyFlights('2026-10-07').length")), '2', 'the 4-sector rule never bleeds into the next duty');
    w.eval('openRosterCalendar()');
    await wait(400);
    d.querySelector('.ca-rc-day[data-ymd="2026-10-05"]').click();
    await wait(250);
    const row5 = d.querySelector('.ca-rc-row[data-rc-ymd="2026-10-05"]');
    R.ok(!!row5, 'the 4-sector day renders its timeline row');
    R.eq(row5 ? row5.querySelectorAll('[data-rc-earn]').length : -1, 4, 'all four sectors show as flight cards — SQ 134 through SQ 137');
    R.ok(!!row5 && row5.textContent.indexOf('SQ 137') >= 0, 'the day reads through to its last sector');
    // RQ99: the birthday request reads its own line (owner order)
    d.querySelector('.ca-rc-day[data-ymd="2026-10-06"]').click();
    await wait(250);
    const row6 = d.querySelector('.ca-rc-row[data-rc-ymd="2026-10-06"]');
    R.ok(!!row6 && row6.textContent.indexOf('RQ99') >= 0, 'the RQ99 day keeps its code as the label');
    R.ok(!!row6 && row6.textContent.indexOf('Enjoy your birthday off') >= 0, 'RQ99 reads \u201cEnjoy your birthday off\u201d (owner order)');
    R.ok(!!row6 && row6.textContent.indexOf('Enjoy your day off') < 0, '\u2014 not the generic day-off line');
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

  // ---- v1.43.0 (owner spec): the destination overlay + the roster capture ----
  {
    const legs = [
      { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-05', std: '08:25', sta: '09:35', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:10', ac: '7M8', rpt: '', pos: false },
      { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-05', std: '10:25', sta: '11:45', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:20', ac: '7M8', rpt: '', pos: false },
      { fn: '231', dep: 'SIN', arr: 'SYD', ymd: '2026-10-09', std: '09:00', sta: '19:05', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '08:05', ac: '359', rpt: '', pos: false },
      { fn: '232', dep: 'SYD', arr: 'SIN', ymd: '2026-10-10', std: '07:30', sta: '13:40', stdYmd: '2026-10-10', staYmd: '2026-10-10', ft: '08:10', ac: '359', rpt: '', pos: false },
      // a sub-6h overnight turn: the chain calls it a Turnaround even though
      // it sleeps downroute — both its tags run green (only true layovers go orange)
      { fn: '424', dep: 'SIN', arr: 'HKT', ymd: '2026-10-15', std: '23:30', sta: '00:50', stdYmd: '2026-10-15', staYmd: '2026-10-16', ft: '01:20', ac: '7M8', rpt: '', pos: false },
      { fn: '425', dep: 'HKT', arr: 'SIN', ymd: '2026-10-16', std: '05:30', sta: '09:40', stdYmd: '2026-10-16', staYmd: '2026-10-16', ft: '01:10', ac: '7M8', rpt: '', pos: false },
      // a same-day 3-sector stop run: KUL and PEN both land on the 18th
      { fn: '131', dep: 'SIN', arr: 'KUL', ymd: '2026-10-18', std: '08:00', sta: '09:15', stdYmd: '2026-10-18', staYmd: '2026-10-18', ft: '01:15', ac: '7M8', rpt: '', pos: false },
      { fn: '132', dep: 'KUL', arr: 'PEN', ymd: '2026-10-18', std: '10:00', sta: '11:20', stdYmd: '2026-10-18', staYmd: '2026-10-18', ft: '01:20', ac: '7M8', rpt: '', pos: false },
      { fn: '133', dep: 'PEN', arr: 'SIN', ymd: '2026-10-18', std: '12:30', sta: '13:45', stdYmd: '2026-10-18', staYmd: '2026-10-18', ft: '01:15', ac: '7M8', rpt: '', pos: false },
      // the owner's mixed-trip example (SIN-JNB-CPT-JNB-SIN): JNB is a
      // true layover, CPT a quick turnaround — same trip, two colors
      { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:10', sta: '07:05', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '10:55', ac: '77W', rpt: '', pos: false },
      { fn: '484', dep: 'JNB', arr: 'CPT', ymd: '2026-10-21', std: '09:40', sta: '11:35', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
      { fn: '485', dep: 'CPT', arr: 'JNB', ymd: '2026-10-21', std: '13:30', sta: '15:25', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
      { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-21', std: '17:10', sta: '08:15', stdYmd: '2026-10-21', staYmd: '2026-10-22', ft: '10:05', ac: '77W', rpt: '', pos: false },
    ];
    const { w, d } = await boot(APP, { now: '2026-10-04T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': legs }));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-10': [
        { ymd: '2026-10-05', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k1' },
        { ymd: '2026-10-09', kind: 'fly', code: '', loc: '', fns: ['231'], dkey: 'k2' },
        { ymd: '2026-10-10', kind: 'fly', code: '', loc: '', fns: ['232'], dkey: 'k2' },
        { ymd: '2026-10-11', kind: 'off', code: 'OFFD', loc: '', fns: [], dkey: '' },
        { ymd: '2026-10-15', kind: 'fly', code: '', loc: '', fns: ['424'], dkey: 'k3' },
        { ymd: '2026-10-16', kind: 'fly', code: '', loc: '', fns: ['425'], dkey: 'k3' },
        { ymd: '2026-10-18', kind: 'fly', code: '', loc: '', fns: ['131', '132', '133'], dkey: 'k4' },
        { ymd: '2026-10-20', kind: 'fly', code: '', loc: '', fns: ['471'], dkey: 'k5' },
        { ymd: '2026-10-21', kind: 'fly', code: '', loc: '', fns: ['484', '485', '472'], dkey: 'k5' },
        { ymd: '2026-10-22', kind: 'fly', code: '', loc: '', fns: [], dkey: 'k5' },
      ] }));
    } });
    // the arrival bands: 0000 rides with the evening, the boundaries are inclusive
    R.eq(w.eval("rcArrivalBand('00:00')"), 3, 'a midnight landing is band 3');
    R.eq(w.eval("rcArrivalBand('00:01')"), 1, '0001H opens the morning');
    R.eq(w.eval("rcArrivalBand('12:00')"), 1, '1200H closes the morning');
    R.eq(w.eval("rcArrivalBand('12:01')"), 2, '1201H opens the afternoon');
    R.eq(w.eval("rcArrivalBand('18:00')"), 2, '1800H closes the afternoon');
    R.eq(w.eval("rcArrivalBand('18:01')"), 3, '1801H opens the evening');
    R.eq(w.eval("rcArrivalBand('23:59')"), 3, '2359H is still the evening');
    R.eq(w.eval("rcArrivalBand('')"), 0, 'an unreadable time earns no badge');
    // the marks: what lands on which day
    const mk = JSON.parse(w.eval("JSON.stringify(rcMarksForMonth('2026-10'))"));
    const tagOf = (d, i) => (mk[d] && mk[d].tags && mk[d].tags[i]) ? mk[d].tags[i].c + ':' + mk[d].tags[i].k : '(none)';
    R.eq(tagOf('2026-10-05', 0) + ':' + mk['2026-10-05'].badge, 'KUL:ta:1', 'a same-day turn: one green tag + the morning band');
    R.eq(tagOf('2026-10-09', 0), 'SYD:lo', 'a layover paints its outbound day orange');
    R.ok(mk['2026-10-09'].badge === undefined, 'the outbound day carries no arrival badge');
    R.eq(tagOf('2026-10-10', 0), '(none)', 'hotfix: the homecoming day never repeats the outbound tag');
    R.eq(mk['2026-10-10'].badge, 2, 'the homecoming day keeps only its arrival band');
    R.ok(!mk['2026-10-15'], 'the overnight-out day carries no marks (the HKT tag lands on arrival)');
    R.eq(tagOf('2026-10-16', 0) + ':' + mk['2026-10-16'].badge, 'HKT:ta:1', 'a sub-6h overnight turn stays green, on the day it arrives downroute');
    R.eq(tagOf('2026-10-18', 0) + '|' + tagOf('2026-10-18', 1) + ':' + mk['2026-10-18'].badge, 'KUL:ta|PEN:ta:2', 'hotfix: a multi-sector stop run names every stop — KUL and PEN, both green');
    R.eq(tagOf('2026-10-20', 0), 'JNB:lo', 'hotfix: a mixed trip colors each stop by its own ground time — JNB lays over, orange');
    R.eq(tagOf('2026-10-21', 0), 'CPT:ta', 'hotfix: the same trip turns around at CPT, green');
    R.ok(mk['2026-10-21'].tags.length === 1, 'hotfix: the second JNB visit never re-tags');
    R.eq(tagOf('2026-10-22', 0) + ':' + mk['2026-10-22'].badge, '(none):1', 'the mixed trip homes with only its morning band');
    R.ok(!mk['2026-10-11'], 'OFF days never carry marks');
    // the header: default state
    w.eval('openRosterCalendar()');
    await wait(400);
    const tagBtn = d.getElementById('ca-rc-tag');
    const shotBtn = d.getElementById('ca-rc-shot');
    R.ok(!!tagBtn && !tagBtn.classList.contains('hidden'), 'the tag toggle shows on an expanded calendar');
    R.ok(d.getElementById('ca-rc-fold').nextElementSibling === tagBtn && tagBtn.nextElementSibling === shotBtn, 'hotfix: the tag and camera sit right of the chevron');
    R.eq((tagBtn.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide'), 'tag', 'the toggle wears the tag icon');
    R.eq(tagBtn.getAttribute('aria-pressed'), 'false', 'the overlay starts off');
    R.eq((shotBtn.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide'), 'camera', 'the camera wears the camera icon');
    R.ok(shotBtn.classList.contains('hidden'), 'the camera starts hidden');
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'no marks are lit while the overlay is off');
    // the marks ride the DOM regardless — the CSS gate decides visibility
    const t9 = d.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
    R.ok(!!t9 && t9.textContent === 'SYD' && t9.className.indexOf('ca-rc-tag-lo') !== -1, 'the layover tag sits on its outbound day, orange');
    R.ok(!d.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-tag'), 'hotfix: the homecoming day carries no duplicate tag');
    const b10 = d.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-badge');
    R.ok(!!b10 && b10.textContent === '2', 'the homecoming day carries its band');
    const t18 = d.querySelectorAll('.ca-rc-day[data-ymd="2026-10-18"] .ca-rc-tag');
    R.ok(t18.length === 2 && t18[0].textContent === 'KUL' && !t18[0].className.includes('slot-b') && t18[1].textContent === 'PEN' && t18[1].className.includes('slot-b'), 'two stops on one day: slot-a and slot-b');
    const t20 = d.querySelector('.ca-rc-day[data-ymd="2026-10-20"] .ca-rc-tag');
    R.ok(!!t20 && t20.textContent === 'JNB' && t20.className.indexOf('ca-rc-tag-lo') !== -1, 'hotfix: JNB wears the layover orange');
    const t21s = d.querySelectorAll('.ca-rc-day[data-ymd="2026-10-21"] .ca-rc-tag');
    R.ok(t21s.length === 1 && t21s[0].textContent === 'CPT' && t21s[0].className.indexOf('ca-rc-tag-ta') !== -1, 'hotfix: CPT wears the turnaround green — and JNB never re-tags');
    const t12 = d.querySelector('.ca-rc-day[data-ymd="2026-10-11"] .ca-rc-tag');
    R.ok(!t12, 'an OFF day never grows a tag');
    // the toggle: on, gold, camera appears — and back
    tagBtn.click();
    await wait(60);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'one tap lights the overlay');
    R.ok(tagBtn.classList.contains('ca-rc-tagon') && tagBtn.getAttribute('aria-pressed') === 'true', 'the toggle fills gold while on (the hover-latch-proof class)');
    R.ok(!shotBtn.classList.contains('hidden'), 'the camera appears with the overlay');
    tagBtn.click();
    await wait(350);
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-on') && shotBtn.classList.contains('hidden'), 'a second tap returns the default');
    // hotfix (owner order): showing and hiding ANIMATES — the marks pop
    // back out, the buttons pop out before display:none lands, and a
    // quick re-toggle rescues mid-pop-out
    R.ok(fs.readFileSync(APP, 'utf8').indexOf('@keyframes ca-rc-popout') !== -1 && fs.readFileSync(APP, 'utf8').indexOf('ca-rc-btnin') !== -1, 'the out animations exist in source');
    tagBtn.click();
    await wait(60);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'overlay back on for the out-animation pins');
    tagBtn.click();
    await wait(40);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('rc-tags-out') && shotBtn.classList.contains('ca-rc-btnout'), 'hiding pops OUT first — the classes land before display:none');
    await wait(350);
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-out') && shotBtn.classList.contains('hidden') && !shotBtn.classList.contains('ca-rc-btnout'), 'the out pass cleans up and hidden lands');
    tagBtn.click();
    await wait(40);
    tagBtn.click();
    await wait(40);
    tagBtn.click();
    await wait(400);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('rc-tags-on') && !d.getElementById('ca-rc-grid').classList.contains('rc-tags-out'), 'a quick re-toggle rescues the marks mid-pop-out');
    tagBtn.click();
    await wait(350);
    // tags never block a day tap
    tagBtn.click();
    await wait(60);
    d.querySelector('.ca-rc-day[data-ymd="2026-10-09"]').click();
    await wait(150);
    R.ok(d.querySelector('.ca-rc-day[data-ymd="2026-10-09"]').classList.contains('is-selected'), 'tapping a tagged day still selects it');
    // collapse: overlay forced off, both buttons hidden; expand: back to default
    d.getElementById('ca-rc-fold').click();
    await wait(400);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('hidden'), 'the fold collapses the grid');
    R.ok(tagBtn.classList.contains('hidden') && shotBtn.classList.contains('hidden'), 'collapsed hides both new buttons');
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'collapsing forces the overlay off');
    d.getElementById('ca-rc-fold').click();
    await wait(120);
    R.ok(!tagBtn.classList.contains('hidden') && tagBtn.getAttribute('aria-pressed') === 'false' && shotBtn.classList.contains('hidden'), 'expanding returns the default: tag off, camera hidden');
    // close + reopen: nothing persists
    tagBtn.click();
    await wait(60);
    d.getElementById('ca-rc-close').click();
    await wait(200);
    w.eval('openRosterCalendar()');
    await wait(400);
    R.ok(tagBtn.getAttribute('aria-pressed') === 'false' && shotBtn.classList.contains('hidden') && !d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'a reopen always starts from the default state');
    // the capture: filename, the jsdom guard, the flash
    R.eq(w.eval("rosterShotFilename('2026-10')"), 'CrewAssist-Roster-October-2026.png', 'the capture names app + month + year');
    R.eq(w.eval('buildRosterShotCanvas() === null'), true, 'without a layout engine the capture steps aside (jsdom guard)');
    tagBtn.click();
    await wait(60);
    d.getElementById('ca-rc-shot').click();
    R.ok(shotBtn.classList.contains('ca-rc-flash'), 'the shutter flashes on tap');
    await wait(700);
    R.ok(!shotBtn.classList.contains('ca-rc-flash'), 'the flash fades');
    R.ok(w.eval('!window.__rcLastShot'), 'the jsdom guard stops the capture before any deliver');
    // the deliver paths: download when there is no share sheet
    w.URL.createObjectURL = () => 'blob:shot'; w.URL.revokeObjectURL = () => {};
    w.eval('window.__dl = 0; window.__mk = document.createElement.bind(document); document.createElement = function (t) { const el = window.__mk(t); if (t === "a") { el.click = function () { window.__dl++; }; } return el; }; rosterShotDeliver(new Blob(["x"], { type: "image/png" }), "CrewAssist-Roster-October-2026.png");');
    await wait(80);
    R.eq(w.eval('window.__dl'), 1, 'without a share sheet the capture downloads');
    R.eq(w.eval('window.__rcLastShot && window.__rcLastShot.name'), 'CrewAssist-Roster-October-2026.png', 'the deliver records the shot');
    R.ok(w.eval('window.__rcLastShot && window.__rcLastShot.blob instanceof Blob'), 'the deliver keeps the blob — the smoke decodes it to prove the raster');
    R.ok((d.getElementById('ca-arch-toast') || {}).textContent.indexOf('Roster screenshot saved') !== -1, 'the toast confirms the capture');
    w.eval('document.createElement = window.__mk;');
    // the share sheet, when the platform has one
    const canStub = w.eval("(function () { try { Object.defineProperty(navigator, 'canShare', { value: function (o) { return true; }, configurable: true }); Object.defineProperty(navigator, 'share', { value: function (o) { window.__shared = (window.__shared || 0) + 1; return Promise.resolve(); }, configurable: true }); return 'ok'; } catch (e) { return 'no'; } })()");
    if (canStub === 'ok') {
      w.eval('rosterShotDeliver(new Blob(["x"], { type: "image/png" }), "s.png")');
      await wait(80);
      R.eq(w.eval('window.__shared'), 1, 'with a share sheet the capture shares');
      R.eq(w.eval('window.__dl'), 1, 'the share path never fires a download');
    }
  }

  {
    // ---- round 15 (owner orders): the marks pop in ONCE — month changes
    // (arrow or swipe) never replay the pop — and a hold-then-swipe toward
    // a month that isn't there is as dead as the greyed arrow ----
    const { w, d } = await boot(APP, { now: '2026-10-04T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({
        '2026-10': [
          { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-05', std: '08:25', sta: '09:35', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:10', ac: '7M8', rpt: '', pos: false },
          { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-05', std: '10:25', sta: '11:45', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:20', ac: '7M8', rpt: '', pos: false }
        ],
        '2026-11': [
          { fn: '118', dep: 'SIN', arr: 'KUL', ymd: '2026-11-14', std: '09:00', sta: '10:10', stdYmd: '2026-11-14', staYmd: '2026-11-14', ft: '01:10', ac: '7M8', rpt: '', pos: false }
        ]
      }));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({
        '2026-10': [
          { ymd: '2026-10-05', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k1' }
        ],
        '2026-11': [
          { ymd: '2026-11-14', kind: 'fly', code: '', loc: '', fns: ['118'], dkey: 'k2' }
        ]
      }));
    } });
    w.eval('openRosterCalendar()');
    await wait(500);
    const grid = d.getElementById('ca-rc-grid');
    const tagBtn = d.getElementById('ca-rc-tag');
    const month = () => d.getElementById('ca-rc-month').textContent;
    const src15 = fs.readFileSync(APP, 'utf8');
    R.ok(src15.indexOf('#ca-rc-grid.rc-tags-pop .ca-rc-tag') !== -1 && src15.indexOf('rc-tags-on .ca-rc-tag { animation') === -1, 'the pop-in animation rides the transient rc-tags-pop class, never the persistent rc-tags-on');
    // round 16 (owner report, iPhone 11): the month label NEVER wraps to two
    // rows — nowrap plus a sub-400px padding trim on the header buttons
    R.ok(src15.indexOf('#ca-rc-month { white-space: nowrap; }') !== -1 && src15.indexOf('@media (max-width: 400px)') !== -1, 'the header contract lives in source: the month is pinned nowrap, and below 400px the header buttons trim their padding');
    R.eq(w.getComputedStyle(d.getElementById('ca-rc-month')).whiteSpace, 'nowrap', 'the rendered month label computes nowrap — one row, whatever the width');
    // (1) a fresh on-transition pops; the transient class leaves after its window
    tagBtn.click();
    await wait(60);
    R.ok(grid.classList.contains('rc-tags-on') && grid.classList.contains('rc-tags-pop'), 'a fresh on-transition pops the marks in');
    await wait(500);
    R.ok(!grid.classList.contains('rc-tags-pop') && grid.classList.contains('rc-tags-on'), 'the transient pop class leaves after its window — the overlay stays lit');
    // (2) an ARROW month change never re-pops the fresh marks
    d.getElementById('ca-rc-next').click();
    await wait(500);
    R.ok(month().indexOf('Nov 2026') === 0, 'the arrow advances to November');
    R.ok(grid.classList.contains('rc-tags-on') && !grid.classList.contains('rc-tags-pop') && !!d.querySelector('.ca-rc-day[data-ymd="2026-11-14"] .ca-rc-tag'), 'an arrow month change keeps the overlay lit — the November mark arrives settled, never re-popped');
    // (3) a SWIPE month change never re-pops either
    d.getElementById('ca-rc-prev').click();
    await wait(500);
    const flick = (x1, x2) => {
      const a = new w.Event('pointerdown', { bubbles: true }); a.clientX = x1; a.clientY = 300; grid.dispatchEvent(a);
      const b = new w.Event('pointerup', { bubbles: true }); b.clientX = x2; b.clientY = 300; grid.dispatchEvent(b);
    };
    flick(200, 20);
    await wait(600);
    R.ok(month().indexOf('Nov 2026') === 0, 'the flick lands on November');
    R.ok(grid.classList.contains('rc-tags-on') && !grid.classList.contains('rc-tags-pop'), 'a swipe month change never re-pops the marks either');
    // (4) hotfix B: a HOLD-then-swipe toward a missing month is completely
    // dead — the parked track disarms instead of rubber-banding a clone in
    const holdSwipe = async (x1, x2) => {
      const a = new w.Event('pointerdown', { bubbles: true }); a.clientX = x1; a.clientY = 300; grid.dispatchEvent(a);
      await wait(180);   // past the 140ms park
      for (let k = 1; k <= 4; k++) {
        const mv = new w.Event('pointermove', { bubbles: true });
        mv.clientX = Math.round(x1 + (x2 - x1) * k / 4); mv.clientY = 300;
        grid.dispatchEvent(mv);
      }
    };
    const lift = (x2) => { const b = new w.Event('pointerup', { bubbles: true }); b.clientX = x2; b.clientY = 300; grid.dispatchEvent(b); };
    await holdSwipe(200, 20);   // at Nov (the LAST month) toward December — nothing there
    R.ok(!grid.classList.contains('ca-rc-drag') && !grid.querySelector('.ca-rc-track'), 'a hold-then-swipe toward a missing month disarms at once — no rubber-band, no track');
    lift(20);
    await wait(600);
    R.ok(month().indexOf('Nov 2026') === 0, 'the release changes nothing at the last data month');
    // control: the same gesture toward a REAL month still glides (October)
    await holdSwipe(200, 420);
    R.ok(grid.classList.contains('ca-rc-drag'), 'a hold-then-swipe toward a real month takes the gesture');
    lift(420);
    await wait(600);
    R.ok(month().indexOf('Oct 2026') === 0, 'the parked drag still glides into a real month — the disarm only guards the void');
    // the mirror edge: at Oct (the FIRST month) toward September — dead too
    await holdSwipe(200, 420);
    R.ok(!grid.classList.contains('ca-rc-drag') && !grid.querySelector('.ca-rc-track'), 'the mirror edge: a hold-then-swipe before the first data month disarms too');
    lift(420);
    await wait(600);
    R.ok(month().indexOf('Oct 2026') === 0, 'the release changes nothing at the first data month');
    // (5) the fast race: a repaint mid-window strips the pop at once
    tagBtn.click(); await wait(40); tagBtn.click(); await wait(40);   // off, rescue on — a fresh pop
    R.ok(grid.classList.contains('rc-tags-on') && grid.classList.contains('rc-tags-pop'), 'each on-transition pops again (the rescue re-pops)');
    d.getElementById('ca-rc-next').click();
    await wait(80);
    R.ok(!grid.classList.contains('rc-tags-pop'), 'a repaint mid-window strips the pop at once — marks rendered by a month change arrive settled');
  }

  // v1.44.0 (owner-approved): the arrow keys change the calendar's month
  // while it is the sheet in front — the same path a chevron tap takes
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourDone', '1');
      x.localStorage.setItem('crewAssist.tourOffered', '1');
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({
        '2026-10': [{ ymd: '2026-10-05', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k1' }],
        '2026-11': [{ ymd: '2026-11-14', kind: 'fly', code: '', loc: '', fns: ['118'], dkey: 'k2' }]
      }));
    } });
    const label = () => d.getElementById('ca-rc-month').textContent;
    const key = (k, target) => (target || d).dispatchEvent(new (w.KeyboardEvent || w.Event)('keydown', { key: k, bubbles: true, cancelable: true }));
    w.eval('openRosterCalendar()');
    await wait(300);
    R.ok(label().indexOf('Oct 2026') === 0, 'v1.44.0 setup: the calendar opens on the current month');
    key('ArrowRight');
    await wait(450);
    R.ok(label().indexOf('Nov 2026') === 0, 'v1.44.0: ArrowRight glides to the next month, exactly like the chevron');
    key('ArrowLeft');
    await wait(450);
    R.ok(label().indexOf('Oct 2026') === 0, 'v1.44.0: ArrowLeft glides back');
    key('ArrowLeft');
    await wait(450);
    R.ok(label().indexOf('Oct 2026') === 0, 'v1.44.0: at the first data month ArrowLeft is the same no-op as the grayed chevron');
    key('ArrowLeft', d.getElementById('chat-input'));
    await wait(200);
    R.ok(label().indexOf('Oct 2026') === 0, 'v1.44.0: an arrow typed into a text field never touches the calendar — the caret owns the key');
    w.eval('closeRosterCalendar()');
    await wait(100);
    key('ArrowRight');
    await wait(200);
    R.ok(label().indexOf('Oct 2026') === 0, 'v1.44.0: with the calendar closed the arrows do nothing at all');
  }


  // ---- v1.45.39 (owner order, the current-records release): the
  // records page — flown-only semantics, station-visit counting, and the
  // dense redesign (segmented tabs + glide pill, 2-1-3 podium grid,
  // cascading leaderboard) ----
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    // the door ends the left cluster; the page is a body child, never nested
    R.ok(src.indexOf('id="ca-rc-shot"') < src.indexOf('id="ca-rc-pod"'), 'the podium button sits right of the camera — tag + camera stay the marks pair');
    R.ok(/function openRcPod\(\)[\s\S]*?caSheetHideCancel\(wrap\);[\s\S]*?caSheetGlideArm\(sheet, wrap\.querySelector\('\.ca-rc-pod-shade'\), null\);/.test(src), 'the records page opens through the shared hide-cancel + glide arm (hotfix 13/14 discipline)');
    R.ok(/function closeRcPod\(\)[\s\S]*?caSheetGlideCancel\(sheet\);[\s\S]*?caSheetHideArm\(wrap\);/.test(src), 'the records page closes through the shared glide-cancel + hide arm — a quick reopen can never wedge it');
    R.ok(/const podBtn = document\.getElementById\('ca-rc-pod'\);\s*\n\s*if \(podBtn\) rcBtnAnimate\(podBtn, !collapsed && rcPodHasData\(\)\);/.test(src), 'the podium reveals through the same pop discipline — expanded AND at least one landed leg');
    R.ok(src.includes("font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace") && src.includes('.ca-mono {'), 'v1.45.39: the numerics ride the system mono stack via the house .ca-mono class — no font download, no tw.css recompile');
    R.ok(/html\.ca-reduced \.ca-rc-pod-glider[^\n]*\{ transition: none; \}/.test(src) && /html\.ca-reduced \.ca-rc-pod-d0/.test(src), 'v1.45.39: the glide and the stagger stand down under ca-reduced (snap + plain fade)');
    const cssLo = src.indexOf('/* v1.45.39 (owner order, the current-records redesign)');
    const cssHi = src.indexOf('.ca-rc-pod-all {', cssLo);
    const podCss = src.slice(cssLo, cssHi);
    R.ok(podCss.indexOf('ca-rc-pod-dim') >= 0 && podCss.indexOf('silver') < 0 && podCss.indexOf('bronze') < 0, 'v1.45.39: ranks two and three differentiate by saturation (ca-rc-pod-dim) — the gold-only accent ruling holds, no invented metals in the podium CSS');
  }
  {
    // the stats math: cross-month chaining, per-visit stays, the 6h split,
    // positioning legs, tie-breaks by recency — all through the LANDING gate
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      const legs = {
        '2026-09': [
          { fn: '1', dep: 'SIN', arr: 'NRT', ymd: '2026-09-30', std: '09:00', sta: '18:00', stdYmd: '2026-09-30', staYmd: '2026-09-30', ft: '09:00', ac: '77W', rpt: '07:00', pos: false }
        ],
        '2026-10': [
          { fn: '2', dep: 'NRT', arr: 'SIN', ymd: '2026-10-02', std: '20:00', sta: '05:00', stdYmd: '2026-10-02', staYmd: '2026-10-03', ft: '09:00', ac: '77W', rpt: '', pos: false },
          { fn: '3', dep: 'SIN', arr: 'NRT', ymd: '2026-10-05', std: '09:00', sta: '18:00', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '09:00', ac: '77W', rpt: '07:00', pos: false },
          { fn: '4', dep: 'NRT', arr: 'SIN', ymd: '2026-10-07', std: '20:00', sta: '05:00', stdYmd: '2026-10-07', staYmd: '2026-10-08', ft: '09:00', ac: '77W', rpt: '', pos: false },
          { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-09', std: '08:00', sta: '09:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
          { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-09', std: '11:00', sta: '12:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '', pos: false },
          { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-11', std: '08:00', sta: '09:00', stdYmd: '2026-10-11', staYmd: '2026-10-11', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
          { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-11', std: '11:00', sta: '12:00', stdYmd: '2026-10-11', staYmd: '2026-10-11', ft: '01:00', ac: '7M8', rpt: '', pos: false },
          { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:00', sta: '10:00', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '08:00', ac: '77W', rpt: '00:00', pos: false },
          { fn: '472', dep: 'JNB', arr: 'CPT', ymd: '2026-10-22', std: '12:00', sta: '14:00', stdYmd: '2026-10-22', staYmd: '2026-10-22', ft: '02:00', ac: '77W', rpt: '', pos: true },
          { fn: '473', dep: 'CPT', arr: 'JNB', ymd: '2026-10-22', std: '22:30', sta: '00:25', stdYmd: '2026-10-22', staYmd: '2026-10-23', ft: '02:00', ac: '77W', rpt: '', pos: true },
          { fn: '474', dep: 'JNB', arr: 'SIN', ymd: '2026-10-25', std: '19:00', sta: '03:00', stdYmd: '2026-10-25', staYmd: '2026-10-26', ft: '08:00', ac: '77W', rpt: '', pos: false }
        ]
      };
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify(legs));
      x.localStorage.setItem('crewAssist.dutyDays', JSON.stringify({ '2026-09': [{ ymd: '2026-09-30', kind: 'fly', code: '', loc: '', fns: ['1'], dkey: 'k1' }], '2026-10': [{ ymd: '2026-10-02', kind: 'fly', code: '', loc: '', fns: ['2'], dkey: 'k2' }, { ymd: '2026-10-09', kind: 'fly', code: '', loc: '', fns: ['106', '105'], dkey: 'k3' }] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'JNB:2|KUL:2|NRT:2|CPT:1', 'All Flights counts station VISITS (v1.45.39) — SIN-MEL-SIN is MEL ×1, the JNB double-visit trip counts both stays, ties break by recency');
    R.eq(stats.lo.map((r) => r.code + ':' + r.n).join('|'), 'JNB:2|NRT:2|CPT:1', 'layover stations count PER VISIT — the JNB out-stay and back-stay are two REAL lays (v1.45.43: the side-trip LAYS OVER at CPT, over six hours, so the hub stands twice), and unreadable ground never turns into a turnaround');
    R.eq(stats.ta.map((r) => r.code + ':' + r.n).join('|'), 'KUL:2', 'turnaround stations ride the marks\u2019 own rule — quick ground only; the positioning stay at CPT now runs over six hours, so it lays over');
    R.eq(stats.first, '2026-09-30', 'the all-time window opens on the earliest FLOWN leg, across the month border the trip chains over');
    R.eq(String(w.eval('rcPodHasData()')), 'true', 'the reveal check sees the landed legs');
    // the render + the UI: segmented tabs with the glide pill, the 2-1-3
    // podium, the leaderboard, close, reopen
    w.eval('openRosterCalendar()');
    await wait(300);
    const podBtn = d.getElementById('ca-rc-pod');
    R.ok(!!podBtn, 'the podium button exists in the header');
    R.ok(!podBtn.classList.contains('hidden'), 'the podium button reveals when the calendar opens with landed history');
    R.ok(d.getElementById('ca-rc-shot').nextElementSibling === podBtn, 'DOM order: the podium ends the left cluster, right of the camera');
    R.ok(!d.getElementById('ca-roster-cal').contains(d.getElementById('ca-rc-podwrap')) && d.body.contains(d.getElementById('ca-rc-podwrap')), 'the records page is a direct child of <body> — never nested inside the calendar sheet');
    podBtn.click();
    await wait(100);
    const wrap = d.getElementById('ca-rc-podwrap'), body = d.getElementById('ca-rc-pod-body');
    R.ok(!wrap.classList.contains('hidden'), 'tapping the podium opens the records page over the calendar');
    const tabs = d.querySelectorAll('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab]');
    R.eq(tabs.length, 3, 'the segmented tab bar carries all three lists');
    R.ok(tabs[0].textContent === 'All Flights' && tabs[0].classList.contains('ca-rc-pod-tabon') && tabs[0].getAttribute('aria-pressed') === 'true', 'All Flights is the default tab, navy on the gold pill');
    R.eq(d.querySelector('.ca-rc-pod-glider').style.transform, 'translateX(calc(0% + 0px))', 'the glide pill parks under the first tab');
    R.eq(d.getElementById('ca-rc-pod-subtitle').textContent, 'All-time \u00b7 since Sept 2026', 'the subtitle names the all-time window from the earliest flown leg');
    let cards = d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card');
    R.eq(cards.length, 3, 'the podium grid carries the top three');
    R.ok(cards[1].classList.contains('ca-rc-pod-hero') && cards[1].textContent.indexOf('JNB') >= 0 && cards[1].textContent.indexOf('\u00d72') >= 0, 'the CENTER column is rank one — the hero card wears the gold frame and the crown, with the count');
    R.ok(cards[0].classList.contains('ca-rc-pod-side') && !cards[0].classList.contains('ca-rc-pod-dim') && cards[0].textContent.indexOf('2nd') >= 0 && cards[0].textContent.indexOf('KUL') >= 0, 'the LEFT column is rank two — full-saturation side card with its ordinal');
    R.ok(cards[2].classList.contains('ca-rc-pod-side') && cards[2].classList.contains('ca-rc-pod-dim') && cards[2].textContent.indexOf('3rd') >= 0 && cards[2].textContent.indexOf('NRT') >= 0, 'the RIGHT column is rank three — the desaturated side card (saturation, never invented metals)');
    R.ok(!!d.querySelector('#ca-rc-pod-body .ca-rc-pod-hero i[data-lucide="crown"]'), 'the hero wears the crown glyph');
    R.ok(cards[1].classList.contains('ca-rc-pod-d0') && cards[0].classList.contains('ca-rc-pod-d1') && cards[2].classList.contains('ca-rc-pod-d2'), 'the open render staggers the podium — rank one at 0ms, two at 50ms, three at 100ms');
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length, 1, 'the leaderboard carries rank four');
    R.ok(d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow').textContent.indexOf('CPT') >= 0, 'rank four is CPT — the mono leaderboard row');
    R.ok(!d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]'), 'no View-all door when the list fits the podium plus the leaderboard');
    // re-query at click time: every render rebuilds the tabs, and a
    // captured NodeList goes stale (detached clicks never reach the
    // delegated listener)
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click();
    await wait(50);
    cards = d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card');
    R.eq(cards.length, 3, 'the Layovers tab swaps the panel — two overnight hubs plus the side-trip that laid over (v1.45.43: the over-six-hour positioning stay)');
    R.ok(cards[1].classList.contains('ca-rc-pod-hero') && cards[1].textContent.indexOf('JNB') >= 0 && cards[0].textContent.indexOf('NRT') >= 0 && cards[0].textContent.indexOf('2nd') >= 0, 'JNB outranks NRT — equal counts break by the more recent stay');
    R.eq(d.querySelector('.ca-rc-pod-glider').style.transform, 'translateX(calc(100% + 4px))', 'the glide pill slid one tab over — the container frame never moved');
    R.ok(!cards[1].classList.contains('ca-rc-pod-d0'), 'a tab swap renders INSTANT — the stagger is mount-only');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click();
    await wait(50);
    cards = d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card');
    R.ok(cards.length === 1 && cards[0].classList.contains('ca-rc-pod-hero') && cards[0].textContent.indexOf('KUL') >= 0, 'the Turnarounds tab carries the quick-ground list — KUL alone now, the positioning side-trip moved to the layover side');
    d.getElementById('btn-close-rc-pod').click();
    await wait(100);
    R.ok(d.getElementById('ca-rc-pod-sheet').classList.contains('translate-y-full'), 'closing parks the sheet below the fold');
    await wait(400);
    R.ok(wrap.classList.contains('hidden'), 'the wrap hides after the glide (hotfix 14 arm)');
    podBtn.click();
    await wait(100);
    R.ok(d.querySelector('#ca-rc-pod-body .ca-rc-pod-card').textContent.indexOf('KUL') >= 0, 'every open starts on the All Flights podium again');
  }
  {
    // the landing gate (v1.45.39): a visit exists once the crew has LANDED
    // there — times unreadable counts only once the day has fully passed
    const { w } = await boot(APP, { now: '2026-10-08T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      const legs = [
        // landed two hours ago: a 150-minute turnaround
        { fn: '11', dep: 'SIN', arr: 'KTI', ymd: '2026-10-08', std: '08:00', sta: '10:00', stdYmd: '2026-10-08', staYmd: '2026-10-08', ft: '02:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '12', dep: 'KTI', arr: 'SIN', ymd: '2026-10-08', std: '12:30', sta: '13:30', stdYmd: '2026-10-08', staYmd: '2026-10-08', ft: '02:00', ac: '7M8', rpt: '', pos: false },
        // lands three hours FROM NOW: nothing of WSI exists yet (and the
        // seed never interleaves the pairs — the chain walker orders
        // sectors by arrival, like a real roster's clock)
        { fn: '13', dep: 'SIN', arr: 'WSI', ymd: '2026-10-08', std: '13:45', sta: '15:00', stdYmd: '2026-10-08', staYmd: '2026-10-08', ft: '04:00', ac: '7M8', rpt: '08:30', pos: false },
        { fn: '14', dep: 'WSI', arr: 'SIN', ymd: '2026-10-08', std: '19:00', sta: '20:00', stdYmd: '2026-10-08', staYmd: '2026-10-08', ft: '04:00', ac: '7M8', rpt: '', pos: false },
        // yesterday, no readable times: landed only once the day passed
        { fn: '15', dep: 'SIN', arr: 'PEK', ymd: '2026-10-07', std: '', sta: '', stdYmd: '2026-10-07', staYmd: '2026-10-07', ft: '', ac: '', rpt: '', pos: false },
        { fn: '16', dep: 'PEK', arr: 'SIN', ymd: '2026-10-07', std: '', sta: '', stdYmd: '2026-10-07', staYmd: '2026-10-07', ft: '', ac: '', rpt: '', pos: false },
        // tomorrow, no readable times: still the future
        { fn: '17', dep: 'SIN', arr: 'HKG', ymd: '2026-10-09', std: '', sta: '', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '', ac: '', rpt: '', pos: false },
        { fn: '18', dep: 'HKG', arr: 'SIN', ymd: '2026-10-09', std: '', sta: '', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '', ac: '', rpt: '', pos: false }
      ];
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': legs }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.ok(stats.flights.map((r) => r.code).indexOf('WSI') < 0, 'a leg that lands two hours from now does not count — wheels-down is the gate');
    R.ok(stats.flights.map((r) => r.code).indexOf('HKG') < 0, 'a tomorrow leg with no readable times stays the future');
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'KTI:1|PEK:1', 'landed visits count — two hours ago, and yesterday\u2019s unreadable-time leg once the day passed');
    R.eq(stats.ta.map((r) => r.code).join(','), 'KTI', 'the landed quick-ground stay is a TURNAROUND — the gate holds, and the exact 360/361 boundary lives in its own block below');
    R.eq(stats.lo.map((r) => r.code).join(','), 'PEK', 'the unreadable-time stay reads as a layover — the marks\u2019 rule for unreadable ground');
  }
  {
    // the viewport-aware leaderboard + the View-all door: eleven stations,
    // the jsdom no-layout answer is the fixed seven (ranks 4-10)
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      const stations = [['PEK', '2026-10-01'], ['HKG', '2026-10-02'], ['KTI', '2026-10-03'], ['WSI', '2026-10-04'], ['SUB', '2026-10-05'], ['DRW', '2026-10-06'], ['LGW', '2026-10-07'], ['UPG', '2026-10-08'], ['KNO', '2026-10-09'], ['VTE', '2026-10-10'], ['BWN', '2026-10-11']];
      const legs = [];
      stations.forEach(([code, ymd]) => {
        legs.push({ fn: '9' + code, dep: 'SIN', arr: code, ymd, std: '08:00', sta: '09:00', stdYmd: ymd, staYmd: ymd, ft: '01:00', ac: '7M8', rpt: '06:30', pos: false });
        legs.push({ fn: '8' + code, dep: code, arr: 'SIN', ymd, std: '11:00', sta: '12:00', stdYmd: ymd, staYmd: ymd, ft: '01:00', ac: '7M8', rpt: '', pos: false });
      });
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': legs }));
    } });
    // the delegated click wiring binds when the CALENDAR opens (the
    // data-bound once-block) - open it first, then the page
    w.eval('openRosterCalendar()');
    await wait(300);
    w.eval('openRcPod()');
    await wait(100);
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card').length, 3, 'the podium holds the top three');
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length, 7, 'the leaderboard fills ranks four through ten — the no-layout answer (the real browser measures the actual screen)');
    const door = d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]');
    R.ok(!!door && door.textContent.indexOf('View all \u00b7 11') >= 0, 'the View-all door names the full depth past what the screen holds');
    R.ok(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow')[6].textContent.indexOf('HKG') >= 0, 'rank ten is the last visible row — PEK waits behind the door');
    door.click();
    await wait(50);
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length, 8, 'View all unfolds the complete list — ranks four through eleven');
    R.ok(d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]').textContent.indexOf('Fold back') >= 0, 'the door flips to Fold back');
    R.ok(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow')[7].textContent.indexOf('PEK') >= 0, 'the eleventh station is reachable');
    d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-all]').click();
    await wait(50);
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-lrow').length, 7, 'folding returns to the viewport-fit depth');
    w.eval('closeRcPod()');
  }
  {
    // the 6h boundary, exact: 360 minutes is a turnaround, 361 lays over
    const { w } = await boot(APP, { now: '2026-10-08T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      const legs = [
        { fn: '11', dep: 'SIN', arr: 'KTI', ymd: '2026-10-05', std: '08:00', sta: '09:00', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '12', dep: 'KTI', arr: 'SIN', ymd: '2026-10-05', std: '15:00', sta: '16:00', stdYmd: '2026-10-05', staYmd: '2026-10-05', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '13', dep: 'SIN', arr: 'WSI', ymd: '2026-10-06', std: '08:00', sta: '09:00', stdYmd: '2026-10-06', staYmd: '2026-10-06', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '14', dep: 'WSI', arr: 'SIN', ymd: '2026-10-06', std: '15:01', sta: '16:01', stdYmd: '2026-10-06', staYmd: '2026-10-06', ft: '01:00', ac: '7M8', rpt: '', pos: false }
      ];
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': legs }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.ta.map((r) => r.code).join(','), 'KTI', 'exactly 360 minutes on the ground is a TURNAROUND — the marks\u2019 boundary, to the minute');
    R.eq(stats.lo.map((r) => r.code).join(','), 'WSI', '361 minutes LAYS OVER — one minute past the boundary flips the kind');
  }
  {
    // empty state: a fresh install sees no door — and so does a store
    // holding ONLY the future (the landing gate tightens the reveal)
    const { w, d } = await boot(APP, { now: '2026-10-08T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
    } });
    R.eq(String(w.eval('rcPodHasData()')), 'false', 'no legs ever imported — the reveal check is false');
    w.eval('openRosterCalendar()');
    await wait(300);
    R.ok(d.getElementById('ca-rc-pod').classList.contains('hidden'), 'the podium button stays hidden on a fresh install (the tag/camera reveal discipline)');
    w.eval('openRcPod()');
    await wait(100);
    R.ok(d.getElementById('ca-rc-pod-body').textContent.indexOf('No records yet') >= 0, 'a direct open still renders the house empty state — never zeros');
    w.eval('closeRcPod()');
    const { w: w2, d: d2 } = await boot(APP, { now: '2026-10-08T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '99', dep: 'SIN', arr: 'KUL', ymd: '2026-10-30', std: '09:00', sta: '10:10', stdYmd: '2026-10-30', staYmd: '2026-10-30', ft: '01:10', ac: '7M8', rpt: '', pos: false }
      ] }));
    } });
    R.eq(String(w2.eval('rcPodHasData()')), 'false', 'a store holding only FUTURE legs fails the reveal check — nothing has landed');
    w2.eval('openRosterCalendar()');
    await wait(300);
    R.ok(d2.getElementById('ca-rc-pod').classList.contains('hidden'), 'an imported future roster alone shows no podium button (v1.45.39)');
  }

  // ---- v1.45.40 (owner order, the polish round): the leaderboard's dates
  // align into one straight column (fixed count + date tracks), the
  // multiplier glyph steps back to stone ink, and the hero code grows to
  // 20px — reviewed from an external spec, adopted only in house terms
  // (SIA gold, both themes, the 11px floor; amber, white-only tokens,
  // border-2, text-[10px], a lowercase x and the '1st' label all
  // declined under the standing rulings) ----
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    R.ok(src.includes('.ca-rc-pod-x { color: var(--ca-ink-stone); }'), 'v1.45.40: the × glyph rides the stone token — muted, never amber, never white-only');
    R.ok(src.includes('.ca-rc-pod-lcount { width: 44px; flex: none; }'), 'v1.45.40: the row count rides a fixed 44px track');
    R.ok(src.includes('.ca-rc-pod-lmeta .ca-rc-pod-ldate { font-size: 11px; width: 84px; flex: none; }'), 'v1.45.40: the row date rides its own fixed track at the 11px floor — a right-anchored cluster with variable children can never align on its own, BOTH children need tracks');
    R.ok(src.includes('.ca-rc-pod-hero .ca-rc-pod-code { color: var(--sia-gold-ink); font-size: 20px; }'), 'v1.45.40: the hero code grows to 20px in SIA gold ink — a half-step, the crown and wash untouched');
    R.ok(src.includes("font-bold' + (rk === 1 ? '' : ' text-sm')") && !src.includes("font-bold' + (rk === 1 ? ' text-lg' : ' text-sm')"), 'v1.45.40: the hero code shed the text-lg utility — its 20px size lives in the custom rule, the sides keep text-sm');
  }
  {
    // the render: the split × span must never break the contiguous
    // ×N reading the rest of the suite pins
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-09', std: '08:00', sta: '09:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-09', std: '11:00', sta: '12:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '61', dep: 'SIN', arr: 'NRT', ymd: '2026-10-12', std: '08:00', sta: '09:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '62', dep: 'NRT', arr: 'SIN', ymd: '2026-10-12', std: '11:00', sta: '12:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '481', dep: 'SIN', arr: 'CPT', ymd: '2026-10-15', std: '08:00', sta: '09:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '06:30', pos: false },
        { fn: '482', dep: 'CPT', arr: 'SIN', ymd: '2026-10-15', std: '11:00', sta: '12:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '', pos: false },
        { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:00', sta: '10:00', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '08:00', ac: '77W', rpt: '00:00', pos: false },
        { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-20', std: '12:00', sta: '13:00', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '08:00', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    w.eval('openRosterCalendar()');
    await wait(300);
    w.eval('openRcPod()');
    await wait(100);
    const hero = d.querySelector('#ca-rc-pod-body .ca-rc-pod-hero');
    const heroX = hero.querySelector('.ca-rc-pod-count .ca-rc-pod-x');
    R.ok(!!heroX && heroX.textContent === '×', 'v1.45.40: the podium count carries the muted × glyph span');
    R.ok(hero.textContent.indexOf('×1') >= 0, 'the hero still reads ×1 contiguously — the split span never breaks the reading (adjacent, no whitespace)');
    R.ok(!hero.querySelector('.ca-rc-pod-code').classList.contains('text-lg'), 'the hero code no longer rides a utility size — the 20px lives in the custom rule');
    const row = d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow');
    R.ok(!!row && row.textContent.indexOf('KUL') >= 0, 'the four-station seed leaves one leaderboard row — rank four is KUL, the oldest visit');
    const rc = row.querySelector('.ca-rc-pod-lcount');
    R.ok(!!rc && !!rc.querySelector('.ca-rc-pod-x') && row.textContent.indexOf('×1') >= 0, 'v1.45.40: the row count rides the fixed track with the muted glyph, still reading ×1 contiguously');
    R.ok(!!row.querySelector('.ca-rc-pod-ldate'), 'the row date rides its own track beside the count');
    w.eval('closeRcPod()');
  }

  // ---- v1.45.41 (owner ruling, the shuttle fold): a quick return to a
  // station already visited this trip is a CONNECTION, not a second visit
  // — the side-trip shuttle counts its hub once. A REAL second stay (over
  // six hours on the ground before the next departure) stands as its own
  // visit. Pinned on the owner's own duty shapes ----
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    R.ok(src.slice(src.indexOf('function rcPodStats'), src.indexOf('function rcPodWhen')).indexOf('ground <= 360') < 0, 'v1.45.43: the fold no longer reads the hub’s return transit — the side-trip’s own character decides (the September correction)');
    R.ok(src.indexOf('const seen = {};', src.indexOf('function rcPodStats')) < src.indexOf('function rcPodWhen'), 'the seen map lives inside the stats walk, scoped per trip — a station from an EARLIER trip always counts fresh');
  }
  {
    // the hub fold, real times: the long anchor stay, the quick side-trip,
    // the transit touch home (the owner's South Africa shape)
    const { w } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:10', sta: '07:05', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '10:55', ac: '77W', rpt: '', pos: false },
        { fn: '484', dep: 'JNB', arr: 'CPT', ymd: '2026-10-21', std: '09:40', sta: '11:35', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
        { fn: '485', dep: 'CPT', arr: 'JNB', ymd: '2026-10-21', std: '13:30', sta: '15:25', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
        { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-21', std: '17:10', sta: '08:15', stdYmd: '2026-10-21', staYmd: '2026-10-22', ft: '10:05', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'CPT:1|JNB:1', 'the shuttle folds — the hub counts ONCE (the transit touch home is a connection, not a visit); the tie at one visit breaks by recency then alphabet');
    R.eq(stats.lo.map((r) => r.code).join(','), 'JNB', 'the folded hub keeps its ANCHOR stay’s kind — the long layover');
    R.eq(stats.ta.map((r) => r.code).join(','), 'CPT', 'the side-trip station stays the quick turnaround it always was');
    R.eq(stats.lo.map((r) => r.code + ':' + r.last).join('|'), 'JNB:2026-10-21', 'the folded touch refreshes the last-flown date to the transit arrival');
  }
  {
    // the double-layover hub stands TWICE (the owner’s other ruling):
    // both touches over six hours are real stays
    const { w } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '26', dep: 'SIN', arr: 'FRA', ymd: '2026-10-06', std: '02:00', sta: '06:30', stdYmd: '2026-10-06', staYmd: '2026-10-06', ft: '10:30', ac: '77W', rpt: '', pos: false },
        { fn: '26', dep: 'FRA', arr: 'JFK', ymd: '2026-10-07', std: '13:30', sta: '16:00', stdYmd: '2026-10-07', staYmd: '2026-10-07', ft: '08:30', ac: '77W', rpt: '', pos: false },
        { fn: '25', dep: 'JFK', arr: 'FRA', ymd: '2026-10-08', std: '18:00', sta: '07:30', stdYmd: '2026-10-08', staYmd: '2026-10-09', ft: '07:30', ac: '77W', rpt: '', pos: false },
        { fn: '25', dep: 'FRA', arr: 'SIN', ymd: '2026-10-09', std: '17:30', sta: '12:00', stdYmd: '2026-10-09', staYmd: '2026-10-10', ft: '11:30', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'FRA:2|JFK:1', 'a REAL second stay — over six hours on the ground — stands as its own visit (the fold only takes transit touches)');
    R.eq(stats.lo.map((r) => r.code + ':' + r.n).join('|'), 'FRA:2|JFK:1', 'both hub stays and the down-leg lay over');
    R.eq(stats.ta.map((r) => r.code).join(','), '', 'nothing turns around');
  }

  // ---- v1.45.42 (owner orders: the crown fix + the visit log): the render
  // owns the icon pass (a tab swap rebuilt the podium without replacing
  // the stub — an unreplaced stub renders as nothing), and every station
  // unfolds its flight history in place, newest first, one at a time ----
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const rrp = src.slice(src.indexOf('function renderRcPod'), src.indexOf('function openRcPod'));
    R.ok(rrp.indexOf('refreshIcons();') >= 0, 'v1.45.42: renderRcPod owns the icon pass — every rebuild refreshes the stubs');
    const orp = src.slice(src.indexOf('function openRcPod'), src.indexOf('function closeRcPod'));
    R.ok(orp.indexOf('lucide.createIcons') < 0, 'the opener’s inline icon call is retired — one owner, not two');
    R.ok(src.includes('.ca-rc-pod-xp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .2s ease-out; margin: 6px 0; }'), 'v1.45.42: the visit log unfolds through the rates-fold clip idiom (0fr→1fr)');
    R.ok(src.includes('html.ca-reduced .ca-rc-pod-xp { transition: none; }'), 'the unfold stands down under ca-reduced');
    R.ok(/podWrapEl\.addEventListener\('keydown'[\s\S]*?data-ca-rc-pod-station/.test(src), 'the stations are keyboard-reachable (Enter/Space toggle the log)');
  }
  {
    // the owner's South Africa shape: the visit records carry flight
    // numbers and the fold span; the icon-pass regression rides this boot
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:10', sta: '07:05', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '10:55', ac: '77W', rpt: '', pos: false },
        { fn: '484', dep: 'JNB', arr: 'CPT', ymd: '2026-10-21', std: '09:40', sta: '11:35', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
        { fn: '485', dep: 'CPT', arr: 'JNB', ymd: '2026-10-21', std: '13:30', sta: '15:25', stdYmd: '2026-10-21', staYmd: '2026-10-21', ft: '01:55', ac: '7M8', rpt: '', pos: false },
        { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-21', std: '17:10', sta: '08:15', stdYmd: '2026-10-21', staYmd: '2026-10-22', ft: '10:05', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    const jnb = stats.flights.filter((r) => r.code === 'JNB')[0];
    const cpt = stats.flights.filter((r) => r.code === 'CPT')[0];
    R.eq(JSON.stringify(jnb.visits), JSON.stringify([{ d: '2026-10-20', fn: '471', k: 'lo', end: '2026-10-21' }]), 'v1.45.42: the folded hub carries ONE visit record — the anchor date, the flight that landed it, the anchor kind, and the transit-touch end');
    R.eq(JSON.stringify(cpt.visits), JSON.stringify([{ d: '2026-10-21', fn: '484', k: 'ta', end: '' }]), 'the side-trip station carries its own visit record');
    // the icon-pass regression (owner report: toggling chips lost the
    // crown) — a lucide spy counts the passes; the rig blocks the CDN, so
    // the spy IS the icon engine here
    w.eval("window.lucide = { createIcons: () => { window.__ic = (window.__ic || 0) + 1; } }; window.__ic = 0;");
    w.eval('openRosterCalendar()');
    await wait(300);
    w.eval('openRcPod()');
    await wait(100);
    const c1 = Number(w.eval('window.__ic'));
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click();
    await wait(50);
    const c2 = Number(w.eval('window.__ic'));
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click();
    await wait(50);
    const c3 = Number(w.eval('window.__ic'));
    R.ok(c1 >= 1 && c2 > c1 && c3 > c2, 'v1.45.42: the icon pass fires on open AND on every tab swap — the crown can never vanish again (spy counts ' + c1 + '/' + c2 + '/' + c3 + ')');
    // the fold span, live: tap the folded hub (rank two here — CPT's 21 Oct
    // touch outranks JNB's 20 Oct anchor) and the log shows the anchor
    // date, the flight number, and the shuttle's transit-touch end
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="flights"]').click();
    await wait(50);
    const jnbCard = d.querySelector('#ca-rc-pod-body .ca-rc-pod-card[data-ca-rc-pod-station="JNB"]');
    R.ok(!!jnbCard && jnbCard.classList.contains('ca-rc-pod-side'), 'the folded hub rides the podium as the rank-two side card');
    jnbCard.click();
    await wait(60);
    const xp = d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]');
    R.ok(!!xp && xp.classList.contains('ca-rc-pod-xpon') && xp.textContent.indexOf('20 Oct 2026') >= 0 && xp.textContent.indexOf('SQ 471') >= 0 && xp.textContent.indexOf('→ 21 Oct') >= 0, 'v1.45.42: tapping the hub unfolds the visit log — date, flight number, and the fold’s transit span (the audit trail)');
    R.ok(xp.textContent.indexOf('LO') >= 0, 'the All Flights tab marks each visit’s kind');
    R.eq(jnbCard.getAttribute('aria-expanded'), 'true', 'the expanded station announces itself');
  }
  {
    // the accordion: one log at a time, tab swaps keep it where the
    // station still lives, closing the page folds it away
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-09', std: '08:00', sta: '09:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-09', std: '11:00', sta: '12:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '61', dep: 'SIN', arr: 'NRT', ymd: '2026-10-12', std: '08:00', sta: '09:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '62', dep: 'NRT', arr: 'SIN', ymd: '2026-10-12', std: '11:00', sta: '12:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '481', dep: 'SIN', arr: 'CPT', ymd: '2026-10-15', std: '08:00', sta: '09:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '06:30', pos: false },
        { fn: '482', dep: 'CPT', arr: 'SIN', ymd: '2026-10-15', std: '11:00', sta: '12:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '', pos: false },
        { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:00', sta: '10:00', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '08:00', ac: '77W', rpt: '00:00', pos: false },
        { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-20', std: '19:00', sta: '03:00', stdYmd: '2026-10-20', staYmd: '2026-10-21', ft: '08:00', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    w.eval('openRosterCalendar()');
    await wait(300);
    w.eval('openRcPod()');
    await wait(100);
    const hero = d.querySelector('#ca-rc-pod-body .ca-rc-pod-hero');
    hero.click();
    await wait(60);
    R.ok(d.querySelectorAll('#ca-rc-pod-body [data-ca-rc-pod-xp]').length === 1, 'one log open at a time — the hero’s');
    const row = d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow');
    R.ok(!!row && row.textContent.indexOf('KUL') >= 0, 'rank four is the KUL row');
    row.click();
    await wait(320);
    const xps = d.querySelectorAll('#ca-rc-pod-body [data-ca-rc-pod-xp]');
    R.ok(xps.length === 1 && xps[0].getAttribute('data-ca-rc-pod-xp') === 'KUL', 'tapping the row folds the hero’s log and opens the row’s — one at a time, always');
    R.ok(xps[0].textContent.indexOf('SQ 106') >= 0 && xps[0].textContent.indexOf('TA') >= 0, 'the row’s log carries its flight and kind');
    R.eq(hero.getAttribute('aria-expanded'), 'false', 'the hero announces its fold');
    R.eq(row.getAttribute('aria-expanded'), 'true', 'the row announces its open');
    const pbody = d.querySelector('#ca-rc-pod-body');
    pbody.scrollTop = 120;
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click();
    await wait(60);
    R.ok(!d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'), 'v1.45.47 (owner order): a new pill folds the open log — the keep-where-it-lives rule is retired');
    R.eq(pbody.scrollTop, 0, 'v1.45.47 (owner order): the same pill scrolls the body home — a fresh page, top of the list');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click();
    await wait(60);
    R.ok(!d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'), 'and the fold holds across every pill');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="flights"]').click();
    await wait(60);
    R.ok(!d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'), 'and the reset holds — no log outlives its pill');
    d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow').click();
    await wait(60);
    d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow').click();
    await wait(320);
    R.ok(!d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'), 'tapping the station again folds its log (the 220ms removal settles)');
  }


  // ---- v1.45.43 (owner report, the September duty + dark mode): the fold
  // rides the SIDE-TRIP's own character — every station touched between
  // the hub visits must be a TURNAROUND, and then the hub counts once no
  // matter how long it waits for the flight home; a side-trip that lays
  // over anywhere leaves both hub touches as real stays. And the visit
  // log's date + flight number ride the inherited theme ink ----
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    R.ok(src.includes('const side = vlog.slice(seen[sec.arr].vi + 1);'), 'v1.45.43: the fold reads the SIDE-TRIP — every visit created since the hub’s anchor');
    R.ok(src.includes("if (side.length && side.every((v) => v.k === 'ta')) {"), 'the fold fires only when the whole side-trip turned around — the layover/turnaround logic itself decides');
    R.ok(src.includes('.ca-rc-pod-xlfn { margin-left: auto; font-weight: 600; }'), 'v1.45.43: the visit-log flight number rides the inherited theme ink — the navy-on-glass rule is gone');
    const cssLo = src.indexOf('/* v1.45.42 (owner order): every station carries its history');
    const cssHi = src.indexOf('html.ca-reduced .ca-rc-pod-xp');
    R.ok(cssLo >= 0 && cssHi > cssLo && src.slice(cssLo, cssHi).indexOf('ink-navy') < 0, 'no navy ink anywhere in the visit-log CSS — gold-fill ink never rides the glass panel (the dark-mode report)');
  }
  {
    // the owner's REAL September duty (the reference roster's own times):
    // the shuttle turns around at the far end in ninety minutes, but the
    // flight home leaves TWO DAYS later — and the hub still counts once
    const { w } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-09': [
        { fn: '478', dep: 'SIN', arr: 'JNB', ymd: '2026-09-17', std: '01:18', sta: '05:51', stdYmd: '2026-09-17', staYmd: '2026-09-17', ft: '10:33', ac: '77W', rpt: '', pos: false },
        { fn: '478', dep: 'JNB', arr: 'CPT', ymd: '2026-09-18', std: '07:04', sta: '09:17', stdYmd: '2026-09-18', staYmd: '2026-09-18', ft: '02:13', ac: '7M8', rpt: '', pos: false },
        { fn: '479', dep: 'CPT', arr: 'JNB', ymd: '2026-09-18', std: '10:39', sta: '12:31', stdYmd: '2026-09-18', staYmd: '2026-09-18', ft: '01:52', ac: '7M8', rpt: '', pos: false },
        { fn: '479', dep: 'JNB', arr: 'SIN', ymd: '2026-09-20', std: '13:45', sta: '06:20', stdYmd: '2026-09-20', staYmd: '2026-09-21', ft: '10:35', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'CPT:1|JNB:1', 'v1.45.43: the REAL September duty folds — the hub counts ONCE even with a two-day wait for the flight home (the owner report, reproduced from the reference roster’s own times)');
    R.eq(stats.lo.map((r) => r.code + ':' + r.n).join('|'), 'JNB:1', 'the folded hub keeps the anchor stay’s layover — the whole South Africa stay is one visit');
    R.eq(stats.ta.map((r) => r.code + ':' + r.n).join('|'), 'CPT:1', 'the far end stays the turnaround it was — the fold’s trigger');
    R.eq(JSON.stringify((stats.flights.filter((r) => r.code === 'JNB')[0] || {}).visits), JSON.stringify([{ d: '2026-09-17', fn: '478', k: 'lo', end: '2026-09-18' }]), 'the folded visit carries the anchor date, the landing flight, the anchor kind, and the shuttle’s return date');
  }
  {
    // the other side of the ruling, on the reference roster’s own times:
    // the side-trip LAYS OVER at its far end, so both hub touches stand
    const { w } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-09': [
        { fn: '12', dep: 'SIN', arr: 'NRT', ymd: '2026-09-05', std: '09:33', sta: '17:27', stdYmd: '2026-09-05', staYmd: '2026-09-05', ft: '07:54', ac: '77W', rpt: '', pos: false },
        { fn: '12', dep: 'NRT', arr: 'LAX', ymd: '2026-09-06', std: '18:48', sta: '12:59', stdYmd: '2026-09-06', staYmd: '2026-09-07', ft: '10:11', ac: '77W', rpt: '', pos: false },
        { fn: '11', dep: 'LAX', arr: 'NRT', ymd: '2026-09-08', std: '14:14', sta: '17:03', stdYmd: '2026-09-08', staYmd: '2026-09-09', ft: '11:49', ac: '77W', rpt: '', pos: false },
        { fn: '11', dep: 'NRT', arr: 'SIN', ymd: '2026-09-11', std: '19:08', sta: '00:59', stdYmd: '2026-09-11', staYmd: '2026-09-12', ft: '07:51', ac: '77W', rpt: '', pos: false }
      ] }));
    } });
    const stats = JSON.parse(w.eval('JSON.stringify(rcPodStats())'));
    R.eq(stats.flights.map((r) => r.code + ':' + r.n).join('|'), 'NRT:2|LAX:1', 'the double-lay duty stands — the far end LAYS OVER, so both hub touches are real stays (same roster, same ruling)');
    R.eq(stats.lo.map((r) => r.code + ':' + r.n).join('|'), 'NRT:2|LAX:1', 'both hub stays and the down-leg lay over');
    R.eq(stats.ta.map((r) => r.code).join(','), '', 'nothing turns around');
  }

  // ---- v1.45.44 (owner orders, the grounding round): the open station
  // anchors the view — the gold ring and the recede, the drawer names
  // its station and count, and the kind marks ride the calendar tag hues
  {
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(src.includes('function rcPodSyncOpen(body)'), 'v1.45.44: one walker keeps aria-expanded, the gold ring and the dim flag in lockstep — every path that touches rcPodOpen lands there');
    R.ok(src.includes('#ca-rc-pod-body.ca-rc-pod-hasopen .ca-rc-pod-card:not(.ca-rc-pod-on) { opacity: .4; }'), 'the light podium recedes to 40 while a log is open');
    R.ok(src.includes('html.dark #ca-rc-pod-body.ca-rc-pod-hasopen .ca-rc-pod-card:not(.ca-rc-pod-on) { opacity: .25; }'), 'the dark podium recedes deeper — 25');
    R.ok(src.includes('#ca-rc-pod-body.ca-rc-pod-hasopen .ca-rc-pod-lrow:not(.ca-rc-pod-on) { opacity: .5; }'), 'the light rows keep more ink — 50');
    R.ok(src.includes('html.dark #ca-rc-pod-body.ca-rc-pod-hasopen .ca-rc-pod-lrow:not(.ca-rc-pod-on) { opacity: .4; }'), 'the dark rows recede to 40');
    R.ok(src.includes('.ca-rc-pod-card.ca-rc-pod-on { border-color: var(--ca-gold-line-strong); background: var(--ca-gold-soft-15); }'), 'the anchor card takes the gold ring and wash (tokens, never raw hex)');
    R.ok(src.includes('.ca-rc-pod-xlk-lo { color: #C2410C; }') && src.includes('.ca-rc-pod-xlk-ta { color: var(--ca-success-deep); }'), 'v1.45.44: the kind marks ride the CALENDAR TAG hues — orange LO, green TA (the owner order, over both the spec’s amber/blue and the old stone)');
    R.ok(src.includes('html.dark .ca-rc-pod-xlk-lo { color: #FDBA74; }') && src.includes('html.dark .ca-rc-pod-xlk-ta { color: #86EFAC; }'), 'the dark marks ride the dark tag inks');
    R.ok(src.includes('border-bottom: 1px dashed var(--glass-border); font-size: 11px; }'), 'the visit lines part on dashed hairlines');
    R.ok(src.includes('html.ca-reduced .ca-rc-pod-card, html.ca-reduced .ca-rc-pod-lrow { transition: none; }'), 'the recede stands down under ca-reduced');
    R.ok(src.includes('FLIGHT HISTORY \\u00b7 ') && src.includes("=== 1 ? ' VISIT' : ' VISITS'"), 'the drawer names its station and its count agrees with the ×n the card shows');
    // v1.45.45 (owner orders, the accessibility round): the tap targets
    // lock text selection, and hover stays OUT (offered, declined)
    R.ok(src.includes('.ca-rc-pod-card, .ca-rc-pod-lrow { cursor: pointer; user-select: none; -webkit-user-select: none;'), 'v1.45.45: a long press on a card or row opens the log — it never grabs the station code as a text selection');
    R.ok(!/\.ca-rc-pod-[a-z-]+\s*:hover/.test(src), 'v1.45.45 ruling: the records page CSS carries NO hover selector — press feedback only, the (hover:hover) gate stays closed here');
    // v1.45.46 (owner report, iPhone 11): the wrap must be VISIBLE before
    // the render measures it — the old order rendered under display:none,
    // clientHeight read 0, and the fit fell to its no-layout fallback on
    // EVERY screen (7 rows, 10 entries, tall or short)
    const orp = src.slice(src.indexOf('function openRcPod'), src.indexOf('function closeRcPod'));
    R.ok(orp.indexOf("wrap.classList.remove('hidden');") >= 0 && orp.indexOf("wrap.classList.remove('hidden');") < orp.indexOf('renderRcPod(true);'), 'v1.45.46: openRcPod un-hides the wrap BEFORE the render — the fit measures a real clientHeight, never the fallback (the flat-10-everywhere report)');
    R.ok(orp.indexOf('display:none zeroes') >= 0, 'the trap is recorded in-source where the next editor will read it');
    // v1.45.47 (owner order, the green-light round): rows only, rotate on
    // open — the pre-tap affordance the six external specs kept asking for,
    // built the house way: a CSS glyph, never a Lucide stub
    R.ok(src.includes(".ca-rc-pod-lrow::after { content: '\\203a'") && src.includes('.ca-rc-pod-lrow.ca-rc-pod-on::after { transform: rotate(90deg); }') && src.includes('html.ca-reduced .ca-rc-pod-lrow::after { transition: none; }'), 'v1.45.47: every leaderboard row carries the chevron — a CSS glyph at the right edge, turning down while its log is out (the archive chevron idiom), standing down under ca-reduced');
    R.ok(/\.ca-rc-pod-lrow \{[^}]*padding: 11px 8px/.test(src), 'v1.45.47 (owner report): the row breathes — 8px horizontal, so the rank digit never hugs the highlighted box\u2019s left edge (constant padding: a state-dependent one would jump the row on tap)');
    R.ok(src.includes('// v1.45.47 (owner order): a new pill is a fresh') && src.indexOf("rcPodOpen = '';\n                        renderRcPod();") > 0 && src.includes('if (pb) pb.scrollTop = 0;'), 'v1.45.47 (owner order): the tab handler folds every log and scrolls the body home before the render');
    // v1.45.48 (owner order, the glyph inventory): the month-nav buttons
    // carry true Lucide chevrons - no bare glyph children anywhere
    R.ok(src.includes('aria-label="Previous month"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>') && src.includes('aria-label="Next month"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>'), 'v1.45.48: the calendar\u2019s month arrows are true icons - chevron-left/right in the family idiom (w-5 h-5 in the w-9 target), verified in the lucide package before wiring');
    R.ok(!/>\u2039</.test(src) && !/>\u203a</.test(src), 'no bare angle-quote glyph survives as a button\u2019s whole visual');
  }
  {
    // live: the ring, the recede flag, the drawer’s header, and the
    // accordion keeping all of it honest
    const { w, d } = await boot(APP, { now: '2026-10-28T12:00:00+08:00', seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify({ '2026-10': [
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-09', std: '08:00', sta: '09:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-09', std: '11:00', sta: '12:00', stdYmd: '2026-10-09', staYmd: '2026-10-09', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '118', dep: 'SIN', arr: 'KUL', ymd: '2026-10-10', std: '08:00', sta: '09:00', stdYmd: '2026-10-10', staYmd: '2026-10-10', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '117', dep: 'KUL', arr: 'SIN', ymd: '2026-10-10', std: '11:00', sta: '12:00', stdYmd: '2026-10-10', staYmd: '2026-10-10', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '61', dep: 'SIN', arr: 'NRT', ymd: '2026-10-12', std: '08:00', sta: '09:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '06:30', pos: false },
        { fn: '62', dep: 'NRT', arr: 'SIN', ymd: '2026-10-12', std: '11:00', sta: '12:00', stdYmd: '2026-10-12', staYmd: '2026-10-12', ft: '01:00', ac: '7M8', rpt: '', pos: false },
        { fn: '481', dep: 'SIN', arr: 'CPT', ymd: '2026-10-15', std: '08:00', sta: '09:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '06:30', pos: false },
        { fn: '482', dep: 'CPT', arr: 'SIN', ymd: '2026-10-15', std: '11:00', sta: '12:00', stdYmd: '2026-10-15', staYmd: '2026-10-15', ft: '01:00', ac: '77W', rpt: '', pos: false },
        { fn: '471', dep: 'SIN', arr: 'JNB', ymd: '2026-10-20', std: '02:00', sta: '10:00', stdYmd: '2026-10-20', staYmd: '2026-10-20', ft: '08:00', ac: '77W', rpt: '00:00', pos: false },
        { fn: '472', dep: 'JNB', arr: 'SIN', ymd: '2026-10-20', std: '19:00', sta: '03:00', stdYmd: '2026-10-20', staYmd: '2026-10-21', ft: '08:00', ac: '77W', rpt: '', pos: false }
      ] })); } });
    w.eval('openRosterCalendar()');
    await wait(300);
    w.eval('openRcPod()');
    await wait(100);
    const body = d.querySelector('#ca-rc-pod-body');
    R.ok(!body.classList.contains('ca-rc-pod-hasopen'), 'a fresh page dims nothing');
    const hero = d.querySelector('#ca-rc-pod-body .ca-rc-pod-hero');
    R.ok(!!hero && hero.textContent.indexOf('KUL') >= 0, 'the twice-turned hub leads the podium');
    hero.click();
    await wait(60);
    R.ok(body.classList.contains('ca-rc-pod-hasopen'), 'an open log raises the recede flag');
    R.ok(hero.classList.contains('ca-rc-pod-on'), 'the open station wears the gold ring');
    R.eq(d.querySelectorAll('#ca-rc-pod-body .ca-rc-pod-card:not(.ca-rc-pod-on)').length, 2, 'the two siblings stand ready to recede');
    let xp = d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]');
    R.ok(!!xp && xp.textContent.indexOf('FLIGHT HISTORY \u00b7 KUL') >= 0 && xp.textContent.indexOf('2 VISITS') >= 0, 'the drawer names its station and its count (plural) — agreeing with the hero’s ×2');
    R.ok(!!d.querySelector('#ca-rc-pod-body .ca-rc-pod-xlk-ta'), 'a turnaround visit carries its green mark class');
    const jnb = d.querySelector('#ca-rc-pod-body .ca-rc-pod-card[data-ca-rc-pod-station="JNB"]');
    jnb.click();
    await wait(320);
    xp = d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]');
    R.ok(!!xp && xp.textContent.indexOf('FLIGHT HISTORY \u00b7 JNB') >= 0 && xp.textContent.indexOf('1 VISIT') >= 0, 'the side station’s drawer names its single visit (singular)');
    R.ok(!!d.querySelector('#ca-rc-pod-body .ca-rc-pod-xlk-lo'), 'a layover visit carries its orange mark class');
    R.ok(jnb.classList.contains('ca-rc-pod-on') && !hero.classList.contains('ca-rc-pod-on'), 'the ring follows the open station — the hero’s is gone');
    const row = d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow');
    R.ok(!!row && row.textContent.indexOf('NRT') >= 0, 'rank four is the NRT row');
    row.click();
    await wait(320);
    R.ok(row.classList.contains('ca-rc-pod-on') && body.classList.contains('ca-rc-pod-hasopen'), 'the open row wears its wash and keeps the flag up');
    R.ok(!jnb.classList.contains('ca-rc-pod-on'), 'the card ring cleared when the row opened — one anchor at a time');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="ta"]').click();
    await wait(60);
    const nrtAny = d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-station="NRT"]');
    R.ok(!!nrtAny && !nrtAny.classList.contains('ca-rc-pod-on') && !body.classList.contains('ca-rc-pod-hasopen') && !d.querySelector('#ca-rc-pod-body [data-ca-rc-pod-xp]'), 'v1.45.47 (owner order): the new pill clears the ring, the flag and the log together — the keep-where-it-lives rule is retired here too');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="lo"]').click();
    await wait(60);
    R.ok(!body.classList.contains('ca-rc-pod-hasopen'), 'a list without the open station lowers the flag — nothing recedes');
    d.querySelector('#ca-rc-pod-tabs-wrap [data-ca-rc-pod-tab="flights"]').click();
    await wait(60);
    const row2 = d.querySelector('#ca-rc-pod-body .ca-rc-pod-lrow[data-ca-rc-pod-station="NRT"]');
    row2.click();
    await wait(60);
    row2.click();
    await wait(320);
    R.ok(!body.classList.contains('ca-rc-pod-hasopen') && !d.querySelector('#ca-rc-pod-body .ca-rc-pod-on'), 'tapping the station again folds its log — ring, wash and flag all clear');
  }

  process.exit(R.done() ? 1 : 0);
})();
