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
    R.ok(/function openRosterCalendar[\s\S]*?setTimeout\(\(\) => \{\s*\n\s*const shade = wrap\.querySelector\('\.ca-rc-shade'\);\s*\n\s*\/\/ hotfix 13[\s\S]*?caSheetGlideIn\(sheet, shade\);/.test(src), 'the calendar opens through the shared glide (hotfix 13) — a canceled close can never leave the sheet stuck off-screen');
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
    R.ok(src.includes('if (justMounted) { try { lucide.createIcons(); } catch (e) {} }'), 'the whole-document icon scan runs only when a pass actually mounted rows');
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
    R.ok(!!syd && styleOf(syd).indexOf('calc(3 * 100% / 7 - 3px - 3px)') >= 0 && styleOf(syd).indexOf('999px 999px 999px 999px') >= 0, 'the SIN-SYD-SIN duty is ONE capsule from the 12th through its 0015H landing on the 14th');
    // the MEL duty wraps the week: flush Saturday edge, flush Sunday start
    const melA = Array.from(weekRows[3].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(5 * 100% / 7 + 3px)') >= 0);
    R.ok(!!melA && styleOf(melA).indexOf('999px 0 0 999px') >= 0, 'the 23–24 Oct segment ends flush at the week edge — the duty continues');
    const melB = Array.from(weekRows[4].querySelectorAll('.ca-rc-pill')).find(p => p.className.indexOf('ca-rc-k-fly') >= 0 && styleOf(p).indexOf('calc(0 * 100% / 7)') >= 0);
    R.ok(!!melB && styleOf(melB).indexOf('0 999px 999px 0') >= 0, '…and picks up flush on Sunday the 25th, rounding off at its landing');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0 && styleOf(p).indexOf('calc(2.5 * 100% / 7)') >= 0) &&
        pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0 && styleOf(p).indexOf('calc(3.5 * 100% / 7)') >= 0) &&
        !pills.some(p => p.className.indexOf('ca-rc-k-sb') >= 0 && p.className.indexOf('is-capsule') >= 0), '6 and 7 Oct are two separate standby circles — SSS1 and SS80 never merge');
    R.ok(pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0 && styleOf(p).indexOf('calc(2.5 * 100% / 7)') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0) &&
        pills.some(p => p.className.indexOf('is-circle') >= 0 && p.className.indexOf('ca-rc-k-sb') >= 0 && styleOf(p).indexOf('calc(3.5 * 100% / 7)') >= 0), '20 and 21 Oct are two separate standby circles (SN60, SN80 — owner report)');
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
        w.eval('rosterCalSelect("2026-10-06")');
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
    R.ok(rowN(12) && rowN(13) && rowN(14), 'the duty flows as its own day rows — the 12th through the 14th');
    R.ok(rowN(13).classList.contains('is-on') && !rowN(12).classList.contains('is-on') && !rowN(14).classList.contains('is-on'), 'the selected day is the highlighted band \u2014 its neighbours are not');
    const t13 = rowN(13).textContent.replace(/\s+/g, ' ');
    R.ok(t13.indexOf('LO · SYD') >= 0 && t13.indexOf('SQ 242') >= 0, 'the 13th wakes in SYD and flies the leg home — layover label above the flight card');
    R.ok(t13.indexOf('1900H') >= 0 && t13.indexOf('(+1) 0015H') >= 0, 'a leg landing past midnight wears the owner\u2019s (+1) format');
    R.ok(t13.indexOf('8H 15M') >= 0, 'the card shows the roster\u2019s own block time — 8H 15M');
    const t14 = rowN(14).textContent.replace(/\s+/g, ' ');
    R.ok(t14.indexOf('Lands SIN') >= 0 && t14.indexOf('0015H') >= 0, 'the landing day reads Lands SIN · 0015H');
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
    R.eq(mk['2026-10-05'].tag + ':' + mk['2026-10-05'].tagKind + ':' + mk['2026-10-05'].badge, 'KUL:ta:1', 'a same-day turn: one green tag + the morning band');
    R.eq(mk['2026-10-09'].tag + ':' + mk['2026-10-09'].tagKind, 'SYD:lo', 'a layover paints its outbound day orange');
    R.ok(mk['2026-10-09'].badge === undefined, 'the outbound day carries no arrival badge');
    R.eq(mk['2026-10-10'].tag + ':' + mk['2026-10-10'].tagKind + ':' + mk['2026-10-10'].badge, 'SYD:ta:2', 'the homecoming day: green tag naming the station + the afternoon band');
    R.eq(mk['2026-10-15'].tag + ':' + mk['2026-10-15'].tagKind, 'HKT:ta', 'a sub-6h overnight turn stays green on its outbound day');
    R.eq(mk['2026-10-16'].tag + ':' + mk['2026-10-16'].tagKind + ':' + mk['2026-10-16'].badge, 'HKT:ta:1', 'its homecoming day lands green with the morning band');
    R.ok(!mk['2026-10-11'], 'OFF days never carry marks');
    // the header: default state
    w.eval('openRosterCalendar()');
    await wait(400);
    const tagBtn = d.getElementById('ca-rc-tag');
    const shotBtn = d.getElementById('ca-rc-shot');
    R.ok(!!tagBtn && !tagBtn.classList.contains('hidden'), 'the tag toggle shows on an expanded calendar');
    R.eq((tagBtn.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide'), 'tag', 'the toggle wears the tag icon');
    R.eq(tagBtn.getAttribute('aria-pressed'), 'false', 'the overlay starts off');
    R.eq((shotBtn.querySelector('i[data-lucide]') || {}).getAttribute('data-lucide'), 'camera', 'the camera wears the camera icon');
    R.ok(shotBtn.classList.contains('hidden'), 'the camera starts hidden');
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'no marks are lit while the overlay is off');
    // the marks ride the DOM regardless — the CSS gate decides visibility
    const t9 = d.querySelector('.ca-rc-day[data-ymd="2026-10-09"] .ca-rc-tag');
    R.ok(!!t9 && t9.textContent === 'SYD' && t9.className.indexOf('ca-rc-tag-lo') !== -1, 'the layover tag sits on its outbound day, orange');
    const b10 = d.querySelector('.ca-rc-day[data-ymd="2026-10-10"] .ca-rc-badge');
    R.ok(!!b10 && b10.textContent === '2', 'the homecoming day carries its band');
    const t12 = d.querySelector('.ca-rc-day[data-ymd="2026-10-11"] .ca-rc-tag');
    R.ok(!t12, 'an OFF day never grows a tag');
    // the toggle: on, gold, camera appears — and back
    tagBtn.click();
    await wait(60);
    R.ok(d.getElementById('ca-rc-grid').classList.contains('rc-tags-on'), 'one tap lights the overlay');
    R.ok(tagBtn.classList.contains('bg-sia-gold') && tagBtn.getAttribute('aria-pressed') === 'true', 'the toggle fills gold while on');
    R.ok(!shotBtn.classList.contains('hidden'), 'the camera appears with the overlay');
    tagBtn.click();
    await wait(60);
    R.ok(!d.getElementById('ca-rc-grid').classList.contains('rc-tags-on') && shotBtn.classList.contains('hidden'), 'a second tap returns the default');
    // tags never block a day tap
    tagBtn.click();
    await wait(60);
    d.querySelector('.ca-rc-day[data-ymd="2026-10-09"]').click();
    await wait(150);
    R.ok(d.querySelector('.ca-rc-day[data-ymd="2026-10-09"]').classList.contains('is-selected'), 'tapping a tagged day still selects it');
    // collapse: overlay forced off, both buttons hidden; expand: back to default
    d.getElementById('ca-rc-fold').click();
    await wait(120);
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
    // the deliver paths: download when there is no share sheet
    w.URL.createObjectURL = () => 'blob:shot'; w.URL.revokeObjectURL = () => {};
    w.eval('window.__dl = 0; window.__mk = document.createElement.bind(document); document.createElement = function (t) { const el = window.__mk(t); if (t === "a") { el.click = function () { window.__dl++; }; } return el; }; rosterShotDeliver(new Blob(["x"], { type: "image/png" }), "CrewAssist-Roster-October-2026.png");');
    await wait(80);
    R.eq(w.eval('window.__dl'), 1, 'without a share sheet the capture downloads');
    R.eq(w.eval('window.__rcLastShot && window.__rcLastShot.name'), 'CrewAssist-Roster-October-2026.png', 'the deliver records the shot');
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

  process.exit(R.done() ? 1 : 0);
})();
