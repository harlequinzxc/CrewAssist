// Offline menu support (v1.26.0): saved cabin schedules + per-cabin menu
// caches let the flight card, viewer and printer work with no connection;
// the brand dot reflects connectivity and its popover lists what works.
// The per-cabin cache itself predates v1.26.0 — these tests freeze the whole
// offline story together, including the new CABINS schedule cache, the
// honest refusals, the 5-flight prune (duty flights protected since v1.34.1)
// and the status dot.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
const path = require('path');

const FLIGHT = '322';
const DATE = '2026-09-26';
const CABIN_KEY = `SQ${FLIGHT}:${DATE}:CABINS`;
const MENU_KEY = `SQ${FLIGHT}:${DATE}:JCL`;
const cabinPayload = (ts) => JSON.stringify({ timestamp: ts, data: {
    statusCode: 200,
    aircraftType: '787-10',
    cabinClasses: ['JCL', 'YCL'],
    legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'NRT' } }]
}});
const menuPayload = (ts) => JSON.stringify({ timestamp: ts, data: {
    statusCode: 200,
    legs: [{ flightDetails: {
        departureAirportCode: 'SIN', arrivalAirportCode: 'NRT',
        departureLocalDate: '2026-09-26 09:20:00', arrivalLocalDate: '2026-09-26 16:05:00',
        departureUtcDate: '2026-09-26 01:20:00', arrivalUtcDate: '2026-09-26 08:05:00',
        flightDuration: '6h 45m'
    } }]
}});
// v1.44.5: the reopen-defaults pin needs a menu with real meal and beverage
// blocks, so the category pills render as meals + drinks + snacks and the
// default (meals) is distinct from a dirtyable choice (drinks)
const richMenuPayload = (ts) => JSON.stringify({ timestamp: ts, data: {
    statusCode: 200,
    legs: [{ flightDetails: {
        departureAirportCode: 'SIN', arrivalAirportCode: 'NRT',
        departureLocalDate: '2026-09-26 09:20:00', arrivalLocalDate: '2026-09-26 16:05:00',
        departureUtcDate: '2026-09-26 01:20:00', arrivalUtcDate: '2026-09-26 08:05:00',
        flightDuration: '6h 45m'
    }, menu: { language: { EN_UK: { meals: [
        { mealServiceName: 'Lunch', selectionDetails: [{ mealCourses: [{ items: [{ name: 'Chicken Rice', description: 'Hainanese' }] }] }] },
        { mealServiceName: 'Supper', selectionDetails: [{ mealCourses: [{ items: [{ name: 'Sandwich' }] }] }] }
    ] } } }, beverage: { language: { EN_UK: { categories: [
        { name: 'Wines', items: [{ name: 'Bordeaux' }] }
    ] } } } }]
}});

(async () => {
  const { w, d } = await boot(APP);
  const setOnline = (v) => Object.defineProperty(w.navigator, 'onLine', { value: v, configurable: true });

  // --- saved-schedule helper ---
  R.eq(w.eval(`readSavedCabinSchedule('${FLIGHT}','${DATE}')`), null, 'no saved schedule reads as null');
  w.localStorage.setItem(CABIN_KEY, cabinPayload(1));
  R.ok(!!w.eval(`readSavedCabinSchedule('${FLIGHT}','${DATE}')`), 'saved schedule parses back');
  w.localStorage.setItem(CABIN_KEY, JSON.stringify({ timestamp: 1, data: { statusCode: 101 } }));
  R.eq(w.eval(`readSavedCabinSchedule('${FLIGHT}','${DATE}')`), null, 'non-200 schedules are ignored');
  w.localStorage.removeItem(CABIN_KEY);

  // --- offline flight card: nothing saved -> clear refusal, no fetch attempt ---
  {
    setOnline(false);
    d.body.insertAdjacentHTML('beforeend', '<div id="fv-action-area-t1"></div><div id="fv-loading-t1" class="hidden"></div>');
    await w.eval(`executeFetchCabins('t1','${FLIGHT}','${DATE}','menu')`);
    await wait(50);
    R.ok(d.getElementById('fv-action-area-t1').textContent.includes('no saved menu for this flight'), 'offline + nothing saved = honest refusal');
    R.ok(d.getElementById('fv-loading-t1').classList.contains('hidden'), 'refusal clears the loading state');
  }

  // --- offline flight card: saved schedule renders sectors + cabins ---
  {
    w.localStorage.setItem(CABIN_KEY, cabinPayload(Date.now()));
    d.body.insertAdjacentHTML('beforeend', '<div id="fv-action-area-t2"></div><div id="fv-loading-t2" class="hidden"></div>');
    await w.eval(`executeFetchCabins('t2','${FLIGHT}','${DATE}','menu')`);
    await wait(50);
    const area = d.getElementById('fv-action-area-t2');
    R.ok(area.textContent.includes('Business') && area.textContent.includes('Economy'), 'offline card lists the saved cabin classes');
    R.eq(area.dataset.singleSector, 'SIN-NRT', 'single-sector saved card carries its sector');
    R.ok(!area.classList.contains('hidden'), 'offline card is visible');
  }

  // --- offline viewer: past-TTL cache still renders, with the saved badge ---
  {
    w.localStorage.setItem(MENU_KEY, menuPayload(Date.now() - 7 * 3600 * 1000));
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL'])`);
    await wait(150);
    R.ok(!d.getElementById('menu-offline-badge').classList.contains('hidden'), 'offline menu shows the badge');
    R.ok(d.getElementById('menu-offline-badge-txt').textContent.indexOf('Offline — menu saved') === 0, 'badge reads "Offline — menu saved <time>"');
  }

  // --- fresh cache (within TTL) renders without the badge, even offline ---
  {
    w.localStorage.setItem(MENU_KEY, menuPayload(Date.now()));
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL'])`);
    await wait(150);
    R.ok(d.getElementById('menu-offline-badge').classList.contains('hidden'), 'fresh cached menu needs no badge');
  }

  // --- printer path: saved copy when the fetch fails, error when nothing saved ---
  {
    w.localStorage.setItem(MENU_KEY, menuPayload(Date.now() - 8 * 3600 * 1000));
    const r = await w.eval(`fetchMenuForPrinter('${FLIGHT}','${DATE}','JCL')`);
    R.ok(r && r.isStale === true && r.data && r.data.statusCode === 200, 'printer falls back to the saved copy');
    w.localStorage.removeItem(MENU_KEY);
    let threw = false;
    try { await w.eval(`fetchMenuForPrinter('${FLIGHT}','${DATE}','JCL')`); } catch (e) { threw = true; }
    R.ok(threw, 'printer errors honestly when nothing was saved');
  }

  // --- prune: cache lives for the recent flights only ---
  {
    w.localStorage.setItem('crewAssist.recentFlights', JSON.stringify([{ flight: '322', date: DATE }, { flight: '321', date: DATE }]));
    w.localStorage.setItem('SQ321:' + DATE + ':CABINS', cabinPayload(1));
    w.localStorage.setItem('SQ999:' + DATE + ':JCL', menuPayload(1));
    w.eval('pruneSqMenuCache()');
    R.ok(w.localStorage.getItem('SQ321:' + DATE + ':CABINS') !== null, 'recent flight keeps its cache');
    R.ok(w.localStorage.getItem('SQ999:' + DATE + ':JCL') === null, 'flight outside the recents is pruned');
    R.ok(w.localStorage.getItem(CABIN_KEY) !== null, 'the looked-up flight keeps its schedule cache');
  }

  // --- v1.34.1 (owner report): the duty's menus survive unrelated searches ---
  {
    const DUTY = '2026-12-25'; // far enough ahead to stay upcoming at any test time
    w.eval('upcomingRemember(' + JSON.stringify({ flights: [
      { ymd: DUTY, fn: '736', dep: 'SIN', arr: 'HKT', stdHm: '09:00', staHm: '10:15' },
      { ymd: DUTY, fn: '735', dep: 'HKT', arr: 'SIN', stdHm: '16:40', staHm: '19:55' }
    ] }) + ')');
    w.localStorage.setItem('SQ736:' + DUTY + ':CABINS', cabinPayload(2));
    w.localStorage.setItem('SQ735:' + DUTY + ':CABINS', cabinPayload(3));
    w.localStorage.setItem('SQ735:' + DUTY + ':JCL', menuPayload(4));
    // five unrelated menu searches fill the recents list past its 5-cap
    ['101', '102', '103', '104', '106'].forEach((fn2) => w.eval("rememberRecentFlight('" + fn2 + "','" + DUTY + "')"));
    w.eval('pruneSqMenuCache()');
    R.ok(w.localStorage.getItem('SQ736:' + DUTY + ':CABINS') !== null, 'SQ736 menus survive a full recents list (owner report: wiped by other searches)');
    R.ok(w.localStorage.getItem('SQ735:' + DUTY + ':JCL') !== null, 'the return leg keeps its saved cabin menu');
    R.ok(w.eval("menusSavedFor('736','" + DUTY + "')"), 'the next-flight card keeps its Menus saved badge');
    // once the duty is no longer upcoming, the recents cap tidies as before
    w.eval('upcomingRemember(' + JSON.stringify({ flights: [
      { ymd: DUTY, fn: '999', dep: 'SIN', arr: 'NRT', stdHm: '23:50', staHm: '23:55' }
    ] }) + ')');
    w.eval('pruneSqMenuCache()');
    R.ok(w.localStorage.getItem('SQ736:' + DUTY + ':CABINS') === null && w.localStorage.getItem('SQ735:' + DUTY + ':JCL') === null, 'a flown duty still tidies away (storage stays bounded)');
  }

  // --- v1.45.5 (owner order, C1): a landed leg's saved menus leave on the sweep ---
  {
    const PAST = '2026-01-01', FUT1 = '2026-12-24', FUT2 = '2026-12-25';
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({
      '2026-01': [{ fn: '111', dep: 'SIN', arr: 'NRT', ymd: PAST, std: '0900', sta: '1700' }],
      '2026-12': [
        { fn: '736', dep: 'SIN', arr: 'HKT', ymd: FUT1, std: '0900', sta: '1015' },
        { fn: '735', dep: 'HKT', arr: 'SIN', ymd: FUT2, std: '1640', sta: '1955' }
      ]
    }));
    w.localStorage.setItem('SQ111:' + PAST + ':CABINS', cabinPayload(1));
    w.localStorage.setItem('SQ111:' + PAST + ':JCL', menuPayload(1));
    w.localStorage.setItem('SQ736:' + FUT1 + ':CABINS', cabinPayload(2));
    w.eval('nextFlightExpirySweep()');
    R.ok(w.localStorage.getItem('SQ111:' + PAST + ':CABINS') === null, 'the landed leg loses its cabin schedule on the sweep');
    R.ok(w.localStorage.getItem('SQ111:' + PAST + ':JCL') === null, 'and its per-cabin menu cache with it');
    R.ok(w.localStorage.getItem('SQ736:' + FUT1 + ':CABINS') !== null, 'an upcoming leg keeps its saved menus');
    const up = JSON.parse(w.localStorage.getItem('crewAssist.upcoming'));
    R.ok(!up['2026-01'] && up['2026-12'].length === 2, 'the landed leg left the upcoming store, the duty stays');
  }

  // --- v1.45.5 (owner order, QOL 2): the cycle button flips through saved menus ---
  {
    const F1 = '2026-12-24', F2 = '2026-12-25';
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-12': [
      { fn: '736', dep: 'SIN', arr: 'HKT', ymd: F1, std: '0900', sta: '1015' },
      { fn: '735', dep: 'HKT', arr: 'SIN', ymd: F2, std: '1640', sta: '1955' }
    ] }));
    w.localStorage.setItem('SQ736:' + F1 + ':CABINS', cabinPayload(3));
    w.localStorage.setItem('SQ736:' + F1 + ':JCL', menuPayload(3));
    w.localStorage.setItem('SQ735:' + F2 + ':CABINS', cabinPayload(4));
    w.localStorage.setItem('SQ735:' + F2 + ':JCL', menuPayload(4));
    await w.eval(`openNextFlightViewer('736','${F1}')`);
    const btn = d.getElementById('btn-menu-cycle');
    R.ok(btn && !btn.classList.contains('hidden'), 'the cycle button shows when 2+ upcoming flights have saved menus');
    R.ok(btn && !!btn.querySelector('[data-lucide="refresh-cw"]'), 'it carries the refresh-cw icon');
    const printBtn = d.getElementById('btn-menu-to-print');
    R.ok(btn && printBtn && (btn.compareDocumentPosition(printBtn) & d.defaultView.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'it sits left of the print button');
    d.getElementById('btn-menu-cycle').click();
    await wait(60);
    R.eq(w.eval('currentMenuSearch.flightNumber'), '735', 'a tap fresh-opens the next saved menu');
    R.ok(d.getElementById('menu-hero-content').textContent.indexOf('SQ735') >= 0, 'the flight hero card names the cycled flight');
    // v1.45.24 (owner order): the hero's centre-axis rigidity - the separator
    // is a standalone absolutely-centred layer between two strictly
    // symmetrical halves
    const heroSrc = fs.readFileSync(APP, 'utf8');
    R.ok(heroSrc.includes('ca-menu-hero-isle absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 z-20 pointer-events-none flex flex-col items-center'), 'the flight separator (arc + plane + duration) is its own standalone layer, absolutely centred on BOTH axes of the stations row');
    R.ok(heroSrc.includes('ca-menu-hero-dep w-1/2 flex flex-col items-end text-right pr-14') && heroSrc.includes('ca-menu-hero-arr w-1/2 flex flex-col items-start text-left pl-14'), 'the station columns are strictly identical halves (w-1/2 each) - departure right-aligned, arrival left-aligned toward the track, each keeping its 56px inner clearance off the centre island');
    R.ok(!heroSrc.includes('flex-[1.2]') && !heroSrc.includes('justify-between items-start'), 'the old content-negotiated centre zone is gone - no flex sibling can slide the track off the card axis');
    const heroIsle = d.querySelector('#menu-hero-content .ca-menu-hero-isle');
    const heroPill = heroIsle ? heroIsle.querySelector('.ca-micro') : null;
    R.ok(!!heroIsle && !!heroPill && heroPill.className.indexOf('whitespace-nowrap') !== -1, 'the duration pill carries the no-wrap constraint - the track and duration string can never drop lines');
    R.ok(!!d.querySelector('#menu-hero-content .ca-menu-hero-dep') && !!d.querySelector('#menu-hero-content .ca-menu-hero-arr'), 'both halves render on the live boot');
    R.ok(!!d.querySelector('#menu-hero-content .ca-menu-hero-dep .truncate') && !!d.querySelector('#menu-hero-content .ca-menu-hero-arr .truncate'), 'the station-name lines ride the truncate triple (nowrap + overflow-hidden + text-ellipsis) beneath their IATA codes');
    d.getElementById('btn-menu-cycle').click();
    await wait(60);
    R.eq(w.eval('currentMenuSearch.flightNumber'), '736', 'the cycle wraps back to the first');
    w.localStorage.removeItem('SQ735:' + F2 + ':CABINS');
    await w.eval(`openNextFlightViewer('736','${F1}')`);
    R.ok(d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'fewer than 2 saved menus → the button hides');
  }

  // --- v1.45.9 + v1.45.10 (owner rulings): the searched flight's own cycle ---
  {
    const F1 = '2026-12-24', F2 = '2026-12-25';
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-12': [
      { fn: '736', dep: 'SIN', arr: 'HKT', ymd: F1, std: '0900', sta: '1015' },
      { fn: '735', dep: 'HKT', arr: 'SIN', ymd: F2, std: '1640', sta: '1955' }
    ] }));
    w.localStorage.setItem('SQ736:' + F1 + ':CABINS', cabinPayload(3));
    w.localStorage.setItem('SQ736:' + F1 + ':JCL', menuPayload(3));
    w.localStorage.setItem('SQ735:' + F2 + ':CABINS', cabinPayload(4));
    w.localStorage.setItem('SQ735:' + F2 + ':JCL', menuPayload(4));
    await w.eval(`openNextFlightViewer('736','${F1}')`);
    R.ok(!d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'a roster open shows the cycle button');
    // the search card's open: the card sets fromSearch before the viewer opens
    w.eval('currentMenuSearch.fromSearch = true');
    await w.eval(`openMenuViewerForCabins('736','${F1}',['JCL'])`);
    R.ok(d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'a searched SINGLE-sector flight hides the cycle button (v1.45.9 + v1.45.10 owner rulings)');
    await w.eval(`openNextFlightViewer('736','${F1}')`);
    R.ok(!d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'a roster open clears the searched flag — the button returns');
    // the printer swap inherits the flag: a searched print keeps the viewer's cycle hidden
    w.eval('currentMenuSearch.fromSearch = true');
    await w.eval(`openMenuPrinter('736','${F1}',['JCL'])`);
    await wait(200);
    await w.eval('switchPrinterToViewer()');
    R.ok(d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'the printer→viewer swap from a searched flight keeps the cycle hidden');
    // leave the flag clear for the blocks that follow
    w.eval('currentMenuSearch.fromSearch = false');
  }

  // --- v1.45.10 (owner rulings): the searched flight cycles ITS OWN sectors ---
  // A multi-sector search shows the cycle button flipping through its own
  // legs (never the saved menus); its print chips are its sectors only; a
  // single-sheet search keeps one inert chip. The nudge set exists the whole
  // time — two saved menus would have leaked in before the ruling.
  {
    const G1 = '2026-12-30', F1 = '2026-12-24', F2 = '2026-12-25';
    const twoLegs = [
      { flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'HKT', departureLocalDate: '2026-12-30 09:20:00', arrivalLocalDate: '2026-12-30 10:35:00', departureUtcDate: '2026-12-30 01:20:00', arrivalUtcDate: '2026-12-30 02:35:00', flightDuration: '2h 15m' } },
      { flightDetails: { departureAirportCode: 'HKT', arrivalAirportCode: 'SIN', departureLocalDate: '2026-12-30 16:40:00', arrivalLocalDate: '2026-12-30 19:55:00', departureUtcDate: '2026-12-30 09:40:00', arrivalUtcDate: '2026-12-30 12:55:00', flightDuration: '2h 15m' } }
    ];
    const twoSectorPayload = (ts) => JSON.stringify({ timestamp: ts, data: { statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL', 'YCL'], legs: twoLegs } });
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-12': [
      { fn: '736', dep: 'SIN', arr: 'HKT', ymd: F1, std: '0900', sta: '1015' },
      { fn: '735', dep: 'HKT', arr: 'SIN', ymd: F2, std: '1640', sta: '1955' }
    ] }));
    w.localStorage.setItem('SQ736:' + F1 + ':CABINS', cabinPayload(3));
    w.localStorage.setItem('SQ736:' + F1 + ':JCL', menuPayload(3));
    w.localStorage.setItem('SQ735:' + F2 + ':CABINS', cabinPayload(4));
    w.localStorage.setItem('SQ735:' + F2 + ':JCL', menuPayload(4));
    w.localStorage.setItem('SQ999:' + G1 + ':CABINS', twoSectorPayload(20));
    w.localStorage.setItem('SQ999:' + G1 + ':JCL', twoSectorPayload(20));
    w.localStorage.setItem('SQ999:' + G1 + ':YCL', twoSectorPayload(21));
    // the viewer: cycle through the searched flight's own sectors
    w.eval(`currentMenuSearch.flightNumber='999'; currentMenuSearch.date='${G1}'; currentMenuSearch.cabins=['JCL','YCL']; currentMenuSearch.fromSearch=true;`);
    await w.eval(`openMenuViewerForCabins('999','${G1}',['JCL'])`);
    await wait(400);
    R.ok(!d.getElementById('btn-menu-cycle').classList.contains('hidden'), 'a searched MULTI-sector flight shows the cycle button');
    R.eq(w.eval('currentMenuSearch.sectorLegs.length'), 2, 'the sector cycle holds the searched flight\u2019s own two legs');
    const first = w.eval('currentMenuSearch.selectedSector');
    d.getElementById('btn-menu-cycle').click();
    await wait(150);
    R.ok(w.eval('currentMenuSearch.selectedSector') !== first, 'a tap steps to the next sector of the searched flight');
    R.eq(w.eval('currentMenuSearch.flightNumber'), '999', 'the cycle never leaves the searched flight');
    d.getElementById('btn-menu-cycle').click();
    await wait(150);
    R.eq(w.eval('currentMenuSearch.selectedSector'), first, 'the sector cycle wraps back to the first');
    // the printer: the searched flight's sector chips only — no saved-menu chips
    w.eval('currentMenuSearch.fromSearch = true');
    await w.eval(`openMenuPrinter('999','${G1}',['JCL','YCL'])`);
    await wait(300);
    const frowA = d.getElementById('print-flight-row');
    R.ok(frowA && !frowA.classList.contains('hidden'), 'the searched multi-sheet duty shows its chip line');
    R.eq(frowA.querySelectorAll('button').length, 2, 'only the searched flight\u2019s sector chips render — the two saved menus never leak in');
    frowA.querySelectorAll('button')[1].click();
    await wait(200);
    R.eq(w.eval('printState.sectorIdx'), 1, 'a sector chip still picks its sheet');
    // the printer: a single-sheet search keeps ONE inert chip
    w.localStorage.setItem('SQ998:' + G1 + ':CABINS', cabinPayload(30));
    w.localStorage.setItem('SQ998:' + G1 + ':JCL', menuPayload(30));
    w.eval('currentMenuSearch.fromSearch = true');
    await w.eval(`openMenuPrinter('998','${G1}',['JCL'])`);
    await wait(300);
    const frowB = d.getElementById('print-flight-row');
    R.ok(frowB && !frowB.classList.contains('hidden'), 'a single-sheet search still shows its chip line');
    R.eq(frowB.querySelectorAll('button').length, 1, 'the single-sheet search keeps exactly ONE chip');
    frowB.querySelectorAll('button')[0].click();
    await wait(250);
    R.eq(w.eval('currentMenuSearch.flightNumber') === '998' && w.eval('printState.sectorIdx') === 0 && w.eval('printState.layout') === 'elegant', true, 'tapping that chip does nothing — no fresh open, no sheet change');
    // leave the flag clear for the blocks that follow
    w.eval('currentMenuSearch.fromSearch = false');
  }

  // --- v1.45.6 (owner order): the printer's flight chips pick the saved menu ---
  {
    const G1 = '2026-12-26', G2 = '2026-12-27';
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-12': [
      { fn: '736', dep: 'SIN', arr: 'HKT', ymd: G1, std: '0900', sta: '1015' },
      { fn: '735', dep: 'HKT', arr: 'SIN', ymd: G2, std: '1640', sta: '1955' }
    ] }));
    w.localStorage.setItem('SQ736:' + G1 + ':CABINS', cabinPayload(5));
    w.localStorage.setItem('SQ736:' + G1 + ':JCL', menuPayload(5));
    w.localStorage.setItem('SQ736:' + G1 + ':YCL', menuPayload(6));
    w.localStorage.setItem('SQ735:' + G2 + ':CABINS', cabinPayload(7));
    w.localStorage.setItem('SQ735:' + G2 + ':JCL', menuPayload(7));
    w.localStorage.setItem('SQ735:' + G2 + ':YCL', menuPayload(8));
    await w.eval(`openMenuPrinter('736','${G1}',['JCL'])`);
    await wait(200);
    const frow = d.getElementById('print-flight-row');
    R.ok(frow && !frow.classList.contains('hidden'), 'the flight chip row shows when 2+ saved menus exist');
    const chips = frow ? frow.querySelectorAll('button') : [];
    R.eq(chips.length, 2, 'one chip per saved menu, chronological');
    R.ok(frow.textContent.indexOf('SIN → HKT') >= 0 && frow.textContent.indexOf('HKT → SIN') >= 0, 'chips carry the pure route, exactly like sector chips');
    R.ok(chips.length === 2 && chips[0].querySelector('.print-sector-num') && chips[0].querySelector('.print-sector-num').textContent === '1', 'the chips mirror the sector-chip markup (numbered)');
    R.ok(chips.length === 2 && chips[0].className.indexOf('border-sia-gold') >= 0 && chips[1].className.indexOf('border-sia-gold') < 0, 'the open flight\u2019s chip is the selected one');
    // fresh open ruling: dirty the layout, tap the other chip, defaults return
    w.eval("printState.layout = 'compact'");
    const live = d.querySelectorAll('#print-flight-row button');
    live[1].click();
    await wait(250);
    R.eq(w.eval('currentMenuSearch.flightNumber'), '735', 'tapping a chip opens that flight in the printer');
    R.ok(d.getElementById('print-title').textContent.indexOf('735') >= 0, 'the printer title names the newly picked flight');
    R.eq(w.eval('printState.layout'), 'elegant', 'a chip tap is a fresh open — the v1.44.5 defaults return');
    // fewer than 2 saved menus → the row hides
    w.localStorage.removeItem('SQ735:' + G2 + ':CABINS');
    await w.eval(`openMenuPrinter('736','${G1}',['JCL'])`);
    await wait(200);
    R.ok(d.getElementById('print-flight-row').classList.contains('hidden'), 'fewer than 2 saved menus → the row hides');
  }

  // --- v1.45.9 (owner ruling): ONE chip line — sector chips join the flight row ---
  {
    const H1 = '2026-12-28', H2 = '2026-12-29';
    const twoLegs = [
      { flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'HKT', departureLocalDate: '2026-12-28 09:20:00', arrivalLocalDate: '2026-12-28 10:35:00', departureUtcDate: '2026-12-28 01:20:00', arrivalUtcDate: '2026-12-28 02:35:00', flightDuration: '2h 15m' } },
      { flightDetails: { departureAirportCode: 'HKT', arrivalAirportCode: 'SIN', departureLocalDate: '2026-12-28 16:40:00', arrivalLocalDate: '2026-12-28 19:55:00', departureUtcDate: '2026-12-28 09:40:00', arrivalUtcDate: '2026-12-28 12:55:00', flightDuration: '2h 15m' } }
    ];
    const twoSectorPayload = (ts) => JSON.stringify({ timestamp: ts, data: { statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL', 'YCL'], legs: twoLegs } });
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2026-12': [
      { fn: '736', dep: 'SIN', arr: 'HKT', ymd: H1, std: '0900', sta: '1015' },
      { fn: '735', dep: 'HKT', arr: 'SIN', ymd: H2, std: '1640', sta: '1955' }
    ] }));
    w.localStorage.setItem('SQ736:' + H1 + ':CABINS', twoSectorPayload(11));
    w.localStorage.setItem('SQ736:' + H1 + ':JCL', twoSectorPayload(11));
    w.localStorage.setItem('SQ736:' + H1 + ':YCL', twoSectorPayload(12));
    w.localStorage.setItem('SQ735:' + H2 + ':CABINS', cabinPayload(13));
    w.localStorage.setItem('SQ735:' + H2 + ':JCL', menuPayload(13));
    await w.eval(`openMenuPrinter('736','${H1}',['JCL','YCL'])`);
    await wait(300);
    R.ok(!d.getElementById('print-sector-row'), 'the old second chip row is gone from the DOM');
    const frow = d.getElementById('print-flight-row');
    R.ok(frow && !frow.classList.contains('hidden'), 'the single chip line shows for a multi-sheet duty');
    const chips = frow ? frow.querySelectorAll('button') : [];
    R.eq(chips.length, 4, 'one line: 2 saved-menu chips + 2 sector chips');
    R.ok(!!frow.querySelector('span[aria-hidden="true"]'), 'a hairline divides the flight chips from the sector chips');
    R.ok(frow.textContent.indexOf('SIN → HKT') >= 0 && frow.textContent.indexOf('HKT → SIN') >= 0, 'both groups carry their pure routes');
    R.eq(w.eval('printState.sectorIdx'), 0, 'the first sheet starts selected');
    chips[3].click();
    await wait(200);
    R.eq(w.eval('printState.sectorIdx'), 1, 'a sector chip in the merged row still picks its sheet');
    R.ok(d.getElementById('print-title').textContent.indexOf('2 sheets') >= 0, 'the title names the two-sheet duty');
    // single-sheet duty + fewer than 2 saved menus → no chip line at all
    w.localStorage.removeItem('SQ735:' + H2 + ':CABINS');
    w.localStorage.setItem('SQ736:' + H1 + ':CABINS', cabinPayload(14));
    w.localStorage.setItem('SQ736:' + H1 + ':JCL', menuPayload(14));
    await w.eval(`openMenuPrinter('736','${H1}',['JCL'])`);
    await wait(300);
    R.ok(d.getElementById('print-flight-row').classList.contains('hidden'), 'a single-sheet duty with one saved menu shows no chip line — the route already rides the title');
    R.eq(d.getElementById('print-flight-row').querySelectorAll('button').length, w.eval('menuCycleList().length'), 'a single-sheet duty adds no sector chip of its own');
    R.ok(!d.getElementById('print-flight-row').querySelector('span[aria-hidden="true"]'), 'and no divider renders without both groups');
  }

  // --- the status dot + capability popover ---
  {
    setOnline(true);
    w.eval('updateNetStatus()');
    const core = d.getElementById('net-status-dot-core');
    R.ok(core.className.includes('bg-green-500') && core.className.includes('animate-pulse'), 'online dot pulses green');
    setOnline(false);
    w.dispatchEvent(new w.Event('offline'));
    R.ok(core.className.includes('border-2 border-amber-500') && core.className.includes('bg-transparent') && !core.className.includes('animate-pulse'), 'v1.37.0: offline turns the dot into a steady hollow amber ring, keeping online solidly green');
    d.getElementById('net-status-dot').click();
    await wait(60);
    const pop = d.getElementById('net-status-pop');
    R.ok(!pop.classList.contains('hidden'), 'tapping the dot opens the popover');
    await wait(300);
    R.ok(!pop.className.includes('opacity-0') && !pop.className.includes('scale-95'), 'popover fades and scales in (animation settles)');
    R.ok(pop.textContent.includes('Offline — using saved data'), 'popover states offline');
    R.ok(pop.textContent.includes('Saved menus —'), 'popover counts saved menus');
    R.ok(pop.textContent.includes('Rates last checked'), 'popover shows when rates were last checked');
    R.ok(pop.textContent.includes('Live menu lookups'), 'popover flags live lookups');
    d.getElementById('net-status-dot').click();
    await wait(60);
    R.ok(pop.classList.contains('opacity-0') && pop.classList.contains('scale-95'), 'popover animates out before hiding');
    await wait(300);
    R.ok(pop.classList.contains('hidden'), 'popover hidden after the close animation');
    setOnline(true);
    w.dispatchEvent(new w.Event('online'));
  }

  // --- persistent storage is requested ---
  {
    let called = false;
    Object.defineProperty(w.navigator, 'storage', { value: { persist: () => { called = true; return Promise.resolve(true); } }, configurable: true });
    await w.eval('requestPersistentStorage()');
    R.ok(called, 'persistent storage is requested');
  }

  // --- v1.34.2 (owner report): the duty card opens its OWN menu after any search ---
  {
    const { w, d } = await boot(APP);
    const D2 = '2026-12-26';
    w.localStorage.setItem('SQ736:' + D2 + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: {
        statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL'],
        legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'HKT' } }]
    }}));
    w.localStorage.setItem('SQ736:' + D2 + ':JCL', JSON.stringify({ timestamp: Date.now(), data: {
        statusCode: 200,
        legs: [{ mealServices: [], flightDetails: {
            departureAirportCode: 'SIN', arrivalAirportCode: 'HKT',
            departureCityName: 'Singapore', arrivalCityName: 'Phuket',
            departureLocalDate: '2026-12-26 09:20:00', arrivalLocalDate: '2026-12-26 10:35:00',
            departureUtcDate: '2026-12-26 01:20:00', arrivalUtcDate: '2026-12-26 02:35:00',
            flightDuration: '1h 15m'
        } }]
    }}));
    // a previous flight search left its sector picks on the global search state
    w.eval("currentMenuSearch.selectedSectors = ['SIN-ICN']");
    await w.eval('openNextFlightMenus("736","' + D2 + '")');
    await wait(500);
    R.eq(String(w.eval('currentMenuSearch.selectedSectors.length')), '0', "the duty card clears the searched flight's sector filter");
    const hero = (d.getElementById('menu-hero-content') || {}).textContent || '';
    R.ok(hero.includes('HKT'), "the duty's own menu renders — not the searched flight's (SQ736 owner report)");
  }

  // --- v1.45.33 (owner order): the lightbox pinch engine - ONE unified ---
  // --- gesture, no phases, no dead zones                        ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    const { w, d } = await boot(APP, {});
    const box = () => d.getElementById('menu-lightbox');
    const img = () => d.getElementById('menu-lightbox-img');
    const hint = () => d.getElementById('menu-lightbox-hint');
    w.eval("openMenuLightbox('data:image/png;base64,x')");
    await wait(50);
    R.ok(!box().classList.contains('hidden'), 'the lightbox mounts over the viewer');
    // the transient micro hint: quiet low-contrast micro text, three seconds
    R.ok(hint() && hint().textContent === 'Swipe sideways for other dishes · up or down to close' && !hint().classList.contains('opacity-0') && hint().className.indexOf('duration-500') !== -1 && hint().className.indexOf('ease-in-out') !== -1 && hint().className.indexOf('pointer-events-none') !== -1, 'v1.45.33: the micro hint mounts visible - ca-micro, muted ink, the 500ms ease-in-out fade armed (v1.60.0: the line teaches the swipes now)');
    R.ok(src.includes('#menu-lightbox img.ca-lb-snap { transition: transform 380ms cubic-bezier(0.22, 1.28, 0.36, 1); }') && src.includes('will-change: transform;') && src.includes('touch-action: none;'), 'v1.45.33: the transform parks on the compositor (will-change), the engine owns every touch (touch-action none), and the snap-back rides the gentle elastic ease-out');
    R.ok(src.includes("setTimeout(() => hint.classList.add('opacity-0'), 3000);"), 'v1.45.33: the hint lifecycle is exactly three seconds, then the fade');
    // the unified engine: two pointers = spread scales around the pair pivot
    // AND the midpoint's travel pans - both in the same paint
    const pt = (id, x, y) => { const e = new w.Event('pointerdown', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; box().dispatchEvent(e); };
    const mv = (id, x, y) => { const e = new w.Event('pointermove', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    const up = (id) => { const e = new w.Event('pointerup', { bubbles: true }); e.pointerId = id; w.dispatchEvent(e); };
    // a single finger drags nothing: the engine is the PAIR's
    pt(9, 100, 100);
    mv(9, 400, 500);
    R.ok(img().style.transform === '', 'v1.45.33: a single finger never moves the image - the engine waits for the pair');
    up(9);
    R.ok(!img().classList.contains('ca-lb-snap'), 'v1.45.33: a lone finger releasing snaps nothing');
    // the pair lands, spreads and slides in one continuous motion
    pt(1, 150, 300); pt(2, 250, 300);
    mv(1, 130, 250); mv(2, 290, 330);
    R.eq(img().style.transform, 'translate(10.00px, -10.00px) scale(1.7889)', 'v1.45.33: the spread scales around the pivot while the midpoint pans - zoom and travel in the same paint (no phases, no dead zones)');
    R.ok(img().classList.contains('ca-lb-live'), 'v1.45.33: the compositor promotion is born with the pair - never at rest');
    // a gesture's trailing click never closes the view
    d.getElementById('menu-lightbox-dismiss').click();
    R.ok(!box().classList.contains('opacity-0'), 'v1.45.33: a click riding a gesture never closes the lightbox');
    img().click();
    R.ok(!box().classList.contains('opacity-0'), 'v1.45.33: a tap on the image right after a pinch stays open too (v1.59.0: the image tap does nothing at all now - the door is gone)');
    // the release springs home
    up(1);
    R.ok(img().classList.contains('ca-lb-snap') && img().style.transform === 'translate(0.00px, 0.00px) scale(1.0000)', 'v1.45.33: the pair breaks - the elastic ease-out snaps the image back to its baseline');
    await wait(500);
    R.ok(!img().classList.contains('ca-lb-snap') && !img().classList.contains('ca-lb-live'), 'v1.45.33: the snap-back class and the compositor promotion both retire when the spring lands');
    // exactly three seconds in, the hint is gone
    await wait(2700);
    R.ok(hint().classList.contains('opacity-0'), 'v1.45.33: exactly three seconds from mount, the hint fades to nothing');
    // the view still open; v1.59.0 (owner order): a plain tap on the photo
    // does NOTHING - the image door is gone; the veil tap is the exit
    R.ok(!box().classList.contains('hidden'), 'v1.45.33: the lightbox is still up after the full gesture cycle');
    img().click();
    await wait(350);
    R.ok(!box().classList.contains('hidden') && !box().classList.contains('opacity-0'), 'v1.59.0 (owner order): a plain tap on the photo does nothing - the image door is gone');
    d.getElementById('menu-lightbox-dismiss').click();
    await wait(350);
    R.ok(box().classList.contains('hidden'), 'v1.59.0: the veil tap still exits the view');
    // the reopen: a fresh mount re-arms the hint's three seconds
    w.eval("openMenuLightbox('data:image/png;base64,x')");
    await wait(50);
    R.ok(!hint().classList.contains('opacity-0'), 'v1.45.33: a fresh mount brings the hint back - the lifecycle is per-view');
    w.eval('closeMenuLightbox()');
    await wait(350);
  }

  // --- v1.45.35 (owner report: "sometimes I cannot exit out of the     ---
  // --- image by tapping outside of the image"): the exit guard could   ---
  // --- STICK - a lone pointerdown inside the 460ms trailing-click      ---
  // --- window ate the only timer that ever cleared lbGestRan, and     ---
  // --- from then on no tap, veil or image, could ever close the view  ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    const { w, d } = await boot(APP, {});
    const box = () => d.getElementById('menu-lightbox');
    const img = () => d.getElementById('menu-lightbox-img');
    w.eval("openMenuLightbox('data:image/png;base64,x')");
    await wait(50);
    const pt = (id, x, y) => { const e = new w.Event('pointerdown', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; box().dispatchEvent(e); };
    const mv = (id, x, y) => { const e = new w.Event('pointermove', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    const upAt = (id, x, y) => { const e = new w.Event('pointerup', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    // a pinch: the pair lands, breaks - the trailing-click guard window arms
    pt(1, 150, 300); pt(2, 250, 300);
    mv(1, 130, 250); mv(2, 290, 330);
    upAt(1, 130, 250);
    // the pair's own trailing click (no fresh pointer behind it) stays guarded
    d.getElementById('menu-lightbox-dismiss').click();
    R.ok(!box().classList.contains('opacity-0'), 'v1.45.35: the pair\u2019s trailing click stays guarded right after the break');
    img().click();
    R.ok(!box().classList.contains('opacity-0'), 'v1.45.35: the image door guards the same trailing click (v1.59.0: trivially now — the photo tap does nothing at all)');
    // THE OWNER BUG: a fresh lone tap inside the guard window - the exact tap
    // whose pointerdown used to eat the cleanup timer and stick the guard
    pt(7, 200, 100); upAt(7, 200, 100);
    d.getElementById('menu-lightbox-dismiss').click();
    R.ok(box().classList.contains('opacity-0'), 'v1.45.35: a quick tap on the veil right after the pinch CLOSES the view - a deliberate tap is never the pinch\u2019s trailing click (the owner bug)');
    await wait(400);
    R.ok(box().classList.contains('hidden'), 'v1.45.35: the quick-tap close completes - the view is gone');
    // the close wiped the whole interaction state: a reopen exits on a plain tap, no residue
    w.eval("openMenuLightbox('data:image/png;base64,x')");
    await wait(50);
    R.ok(!box().classList.contains('hidden') && !box().classList.contains('opacity-0'), 'v1.45.35: the lightbox reopens clean after the quick-tap close');
    img().click();
    await wait(350);
    R.ok(!box().classList.contains('hidden'), 'v1.59.0 (owner order): a plain tap on the reopened photo does nothing - the image door is gone');
    d.getElementById('menu-lightbox-dismiss').click();
    await wait(350);
    R.ok(box().classList.contains('hidden'), 'v1.45.35: the guard state dies with the view - the VEIL tap exits the reopened view');
    // a lone DRAG never marks a fresh tap: down, travel, lift far from the origin
    w.eval("openMenuLightbox('data:image/png;base64,x')");
    await wait(50);
    pt(3, 150, 300); pt(4, 250, 300);
    upAt(3, 150, 300);
    pt(8, 100, 400); mv(8, 300, 500); upAt(8, 300, 500);
    d.getElementById('menu-lightbox-dismiss').click();
    R.ok(!box().classList.contains('opacity-0'), 'v1.45.35: a lone drag lifts far from its origin - it never marks a fresh tap, its click stays guarded');
    await wait(500);
    d.getElementById('menu-lightbox-dismiss').click();
    R.ok(box().classList.contains('opacity-0'), 'v1.45.35: once the guard window lapses the veil tap exits again - the guard is a window, never a wall');
    await wait(400);
    // the source shape: ONLY a real pair may cancel the landing cleanup
    const pdH = src.slice(src.indexOf("box.addEventListener('pointerdown'"), src.indexOf("window.addEventListener('pointermove'", src.indexOf("box.addEventListener('pointerdown'")));   // v1.59.0: the img click listener is gone - the slice ends at the engine's OWN move listener (two earlier pointermove listeners live elsewhere in the app)
    R.ok(pdH.indexOf('if (lbGestPts.size === 2)') !== -1 && pdH.indexOf('clearTimeout(lbGestEaseT);') > pdH.indexOf('if (lbGestPts.size === 2)'), 'v1.45.35: the clearTimeout sits INSIDE the pair branch - a lone pointer can never cancel the landing cleanup (the stuck-guard root cause)');
    R.ok(src.includes('lbGestRan = false; lbGestIds = null; lbFreshTap = false;'), 'v1.45.35: the close path wipes the whole interaction state - a stale guard never survives a reopen');
    R.ok(src.split('(!lbGestRan || lbFreshTap)').length - 1 === 1, 'v1.45.35 + v1.59.0: ONE door takes the fresh-tap allowance now - the veil alone (the photo\u2019s own tap door is gone)');
  }

  // --- v1.60.0 (owner orders, the swipe round): a finger on the  ---
  // --- photo takes it INSTANTLY - the first clear direction locks ---
  // --- the axis; sideways flips dishes, up/down peels the backdrop ---
  // --- and dismisses past the 80px bar; a plain tap does nothing  ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    const { w, d } = await boot(APP, {});
    const box = () => d.getElementById('menu-lightbox');
    const img = () => d.getElementById('menu-lightbox-img');
    const dim = () => d.getElementById('menu-lightbox-dim');
    const cap = () => d.getElementById('menu-lightbox-dish');
    const A = 'data:image/png;base64,x', B = 'data:image/png;base64,y';
    const rail = "[{ src: 'data:image/png;base64,x', name: 'Herb Chicken' }, { src: 'data:image/png;base64,y', name: 'Seared Salmon' }]";
    w.eval("openMenuLightbox('" + A + "', " + rail + ")");
    await wait(50);
    const pt = (id, x, y) => { const e = new w.Event('pointerdown', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; box().dispatchEvent(e); };
    const pti = (id, x, y) => { const e = new w.Event('pointerdown', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; img().dispatchEvent(e); };   // only a press ON THE PHOTO can take it
    const mv = (id, x, y) => { const e = new w.Event('pointermove', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    const upAt = (id, x, y) => { const e = new w.Event('pointerup', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    const cancelAt = (id, x, y) => { const e = new w.Event('pointercancel', { bubbles: true }); e.pointerId = id; e.clientX = x; e.clientY = y; w.dispatchEvent(e); };
    // the rail opens with its first dish named above the photo
    R.ok(!box().classList.contains('hidden') && cap().textContent === 'Herb Chicken' && !cap().classList.contains('opacity-0'), 'v1.60.0: the lightbox opens with the dish\u2019s name above the photo');
    // (owner order) a plain TAP on the photo does nothing - and leaves the name up
    pti(1, 200, 300);
    upAt(1, 200, 300);
    img().click();
    R.ok(!box().classList.contains('opacity-0') && !box().classList.contains('hidden') && img().style.transform === '' && !cap().classList.contains('opacity-0'), 'v1.60.0 (owner order): a plain tap on the photo does nothing - the image door stays gone, the name stays up');
    // THE INSTANT DRAG (owner order): the first move past the slop takes the photo - no hold, no wait - and it shrinks a touch as it detaches
    pti(2, 200, 300);
    mv(2, 200, 340);
    R.eq(img().style.transform, 'translate(0.00px, 40.00px) scale(0.9500)', 'v1.60.0 (owner order): the photo follows the INSTANT the finger moves - no hold, no wait, detached at 0.95');
    R.ok(img().classList.contains('ca-lb-live') && cap().classList.contains('opacity-0'), 'v1.60.0: the dragged photo rides the compositor and the name steps aside');
    R.eq(dim().style.opacity, '0.5', 'v1.60.0 (owner order): the backdrop dims with the drag - 40 of the 80px bar is half the veil');
    // released under the bar: the spring home, backdrop restored
    upAt(2, 200, 340);
    R.ok(img().classList.contains('ca-lb-snap') && img().style.transform === 'translate(0.00px, 0.00px) scale(1.0000)', 'v1.60.0: released under the 80px bar, the photo springs home at full size');
    R.ok(!box().classList.contains('opacity-0') && dim().style.opacity === '', 'v1.60.0: the short release leaves the view open with the backdrop fully back');
    await wait(500);
    R.ok(!img().classList.contains('ca-lb-snap') && !img().classList.contains('ca-lb-live'), 'v1.60.0: the spring retires its classes when it lands (460ms)');
    // THE AXIS LOCK (owner order): the first clear direction wins - sideways means sideways
    pti(3, 200, 300);
    mv(3, 150, 306);
    R.eq(img().style.transform, 'translate(-50.00px, 0.00px) scale(0.9500)', 'v1.60.0 (owner order): the first clear direction locks the axis - sideways drags along X only');
    mv(3, 150, 470);
    R.eq(img().style.transform, 'translate(-50.00px, 0.00px) scale(0.9500)', 'v1.60.0: once locked sideways, up/down wander never moves the photo');
    R.ok(dim().style.opacity === '', 'v1.60.0: the dim is the dismissal cue alone - sideways never peels it');
    upAt(3, 150, 470);
    await wait(700);
    R.ok(img().getAttribute('src') === B && cap().textContent === 'Seared Salmon' && !cap().classList.contains('opacity-0'), 'v1.60.0 (owner order): the sideways release past a third of the photo flips to the NEXT dish - and its name shows above');
    R.eq(img().style.transform, 'translate(0.00px, 0.00px) scale(1.0000)', 'v1.60.0: the flip glides the new photo home at full size');
    // at the LAST dish, the same left swipe drags heavy and never flips
    pti(4, 200, 300);
    mv(4, 100, 310);
    R.eq(img().style.transform, 'translate(-30.00px, 0.00px) scale(0.9500)', 'v1.60.0: at the last dish the sideways drag feels stuck-in-mud (100px of finger, 30px of photo)');
    upAt(4, 100, 310);
    await wait(500);
    R.ok(img().getAttribute('src') === B && !box().classList.contains('opacity-0'), 'v1.60.0: the ends bounce - no flip past the last dish, no wrap');
    // at the FIRST dish, the rightward swipe drags heavy the same way
    w.eval("openMenuLightbox('" + A + "', " + rail + ")");
    await wait(50);
    pti(5, 200, 300);
    mv(5, 260, 306);
    R.eq(img().style.transform, 'translate(18.00px, 0.00px) scale(0.9500)', 'v1.60.0: at the first dish the rightward drag drags heavy too (60px of finger, 18px of photo)');
    upAt(5, 260, 306);
    await wait(500);
    R.ok(img().getAttribute('src') === A, 'v1.60.0: no flip past the first dish either');
    // a diagonal tie locks up/down (the dismissal axis takes ties)
    pti(6, 200, 300);
    mv(6, 220, 320);
    R.eq(img().style.transform, 'translate(0.00px, 20.00px) scale(0.9500)', 'v1.60.0: a perfect diagonal tie locks up/down - the dismissal axis takes ties');
    upAt(6, 220, 320);
    await wait(500);
    // THE DISMISS (owner order): drag past the 80px bar and let go
    pti(7, 200, 300);
    mv(7, 200, 420);
    R.eq(dim().style.opacity, '0', 'v1.60.0: at the 80px bar the backdrop is fully peeled');
    upAt(7, 200, 420);
    R.ok(box().classList.contains('opacity-0'), 'v1.60.0: released past the bar, the view dismisses');
    await wait(400);
    R.ok(box().classList.contains('hidden'), 'v1.60.0: the drag-dismiss close completes (280ms)');
    // a cancelled finger springs home with the backdrop restored - never a dismissal
    w.eval("openMenuLightbox('" + A + "', " + rail + ")");
    await wait(50);
    pti(8, 200, 300);
    mv(8, 200, 400);
    cancelAt(8, 200, 400);
    R.ok(!box().classList.contains('opacity-0') && img().style.transform === 'translate(0.00px, 0.00px) scale(1.0000)' && dim().style.opacity === '', 'v1.60.0: a cancelled pointer springs the photo home - the backdrop restored, never a dismissal');
    await wait(500);
    // the veil never drags: a held, wandering press off the photo moves nothing
    pt(9, 20, 500);
    mv(9, 20, 640);
    R.ok(img().style.transform === 'translate(0.00px, 0.00px) scale(1.0000)', 'v1.60.0: only the photo answers the finger - a veil press never starts a drag (the resting pose untouched)');
    upAt(9, 20, 640);
    R.ok(!box().classList.contains('opacity-0'), 'v1.60.0: the veil drag-lift stays guarded and open (the veil TAP door is pinned in the 45.35 block)');
    // a BARE open (no rail) keeps every dismissal path and never flips
    w.eval("openMenuLightbox('" + A + "')");
    await wait(50);
    R.ok(cap().classList.contains('opacity-0'), 'v1.60.0: a bare open carries no name');
    pti(10, 200, 300);
    mv(10, 320, 305);
    R.eq(img().style.transform, 'translate(36.00px, 0.00px) scale(0.9500)', 'v1.60.0: with nothing to flip to, sideways drags heavy both ways (120px of finger, 36px of photo)');
    upAt(10, 320, 305);
    await wait(500);
    R.ok(img().getAttribute('src') === A && !box().classList.contains('opacity-0'), 'v1.60.0: the bare sideways release springs home - nothing to flip to');
    pti(11, 200, 300);
    mv(11, 200, 440);
    upAt(11, 200, 440);
    R.ok(box().classList.contains('opacity-0'), 'v1.60.0: the bare open still dismisses up/down - the list only gates the flip');
    await wait(400);
    // the pair still owns two-finger play: a second finger landing on a
    // DRAGGED photo carries the dragged pose (offset AND the 0.95 detach)
    w.eval("openMenuLightbox('" + A + "', " + rail + ")");
    await wait(50);
    pti(12, 140, 360);
    mv(12, 140, 420);                        // the photo sits dragged at (0, 60, 0.95)
    pt(13, 260, 300);                        // the pair lands - the drag dies, the pose carries
    mv(12, 150, 420); mv(13, 270, 300);      // equal spread, the midpoint slides 10px right
    R.eq(img().style.transform, 'translate(10.00px, 60.00px) scale(0.9500)', 'v1.60.0: the pinch continues from wherever the photo sat - the carried offset AND the carried 0.95 ride the pair math');
    upAt(12, 150, 420); upAt(13, 270, 300);
    R.ok(img().classList.contains('ca-lb-snap') && !box().classList.contains('opacity-0'), 'v1.60.0: the pair breaking on a carried drag springs the photo home - never a dismissal');
    await wait(500);
    // the source shape: the constants, the lock, the dim, the release rules,
    // the flip, the rail, the caption, the carried clamp floor
    R.ok(src.indexOf('const LB_TAP_SLOP_PX = 10;') >= 0 && src.indexOf('const LB_CLOSE_PX = 80;') >= 0 && src.indexOf('const LB_DRAG_SCALE = 0.95;') >= 0, 'the swipe constants: the 10px slop, the 80px bar, the 0.95 detach');
    R.ok(src.indexOf("lbDragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';") >= 0, 'the axis lock: the first clear direction wins, coded once');
    R.ok(src.indexOf('lbDimTrack(Math.max(0, 1 - Math.abs(lbDragTy) / LB_CLOSE_PX));') >= 0, 'the backdrop peels in proportion to the vertical drag');
    R.ok(src.indexOf("if (axis === 'y' && e.type !== 'pointercancel' && Math.abs(ty) >= LB_CLOSE_PX) { closeMenuLightbox(); return; }") >= 0, 'the vertical release rule: past the bar on a real lift, dismiss');
    R.ok(src.indexOf("if (axis === 'x' && e.type !== 'pointercancel' && Math.abs(tx) >= lbFlipPx()) { lbFlip(tx < 0 ? 1 : -1); return; }") >= 0, 'the sideways release rule: past a third of the photo, flip the dish');
    R.ok(src.indexOf('function lbFlip(dir)') >= 0 && src.indexOf('return Math.max(50, Math.round(w / 3));') >= 0, 'the flip exists, floored at 50px so tiny photos still flip');
    R.ok(src.indexOf("document.querySelectorAll('.menu-thumb')].filter(function (t) { return !t.closest('.hidden'); })") >= 0, 'the thumb tap hands the lightbox the sector\u2019s whole photo rail - hidden sections never join it');
    R.ok(src.indexOf('id="menu-lightbox-dish"') >= 0 && src.indexOf("img.addEventListener('load', () => lbCaptionShow())") >= 0, 'the caption element exists and re-seats on every photo load');
    R.ok(src.indexOf('Math.max(Math.min(1, lbGestFrom.sc), lbGestFrom.sc * (dist / lbGestBase.dist))') >= 0, 'the pair\u2019s scale floor rides the carried pose - from rest it is 1 (unchanged), from a drag it is 0.95');
    R.ok(src.indexOf("img.addEventListener('click'") === -1, 'the image tap door is GONE - no listener binds the photo\u2019s own click');
    R.ok(src.indexOf('Swipe sideways for other dishes \u00b7 up or down to close') >= 0, 'the hint teaches the swipes (the owner\u2019s approved line)');
  }

  // --- v1.55.0 (B1, owner-ordered): the remote ops switch — ops.json beside rates.json ---
  {
    // the parser first: defaults, validation, the honest shapes
    R.eq(w.eval('parseOpsConfig(null)'), null, 'ops: garbage parses to nothing — the shipped defaults hold');
    R.eq(w.eval('JSON.stringify(parseOpsConfig({}))'), JSON.stringify({ sq: { enabled: true, path: '/api/sq' }, notice: null }), 'ops: an empty object still means SQ on, default path, no notice');
    R.eq(w.eval('JSON.stringify(parseOpsConfig({ sq: { enabled: false, path: "/api/sq2" } }))'), JSON.stringify({ sq: { enabled: false, path: '/api/sq2' }, notice: null }), 'ops: a sane same-origin path override survives validation');
    R.eq(w.eval('parseOpsConfig({ sq: { enabled: false, path: "https://evil.example/x" } }).sq.path'), '/api/sq', 'ops: an absolute-URL path is refused — same-origin paths only');
    R.eq(w.eval('parseOpsConfig({ sq: { enabled: false, path: "//evil.example" } }).sq.path'), '/api/sq', 'ops: a protocol-relative path is refused too');
    R.eq(w.eval('parseOpsConfig({ sq: { enabled: false }, notice: "  SQ is down for maintenance tonight  " }).notice'), 'SQ is down for maintenance tonight', 'ops: the notice rides trimmed');
    R.eq(w.eval('parseOpsConfig({ notice: "x".repeat(141) }).notice'), null, 'ops: a notice past 140 characters is dropped, not truncated');
    // the switch-off boot: the served ops land, and lookups refuse BEFORE any network attempt
    const g2 = await boot(APP, { ops: JSON.stringify({ version: 1, sq: { enabled: false }, notice: 'SQ is down for maintenance tonight' }) });
    await wait(150);
    R.eq(g2.w.eval('APP_OPS.sq.enabled'), false, 'ops: the served switch-off lands in APP_OPS');
    R.eq(g2.w.eval('APP_OPS.sq.path'), '/api/sq', 'ops: an absent path keeps the default');
    R.eq(g2.w.eval('APP_OPS.notice'), 'SQ is down for maintenance tonight', 'ops: the served notice lands');
    R.eq(g2.w.eval('localStorage.getItem("crewAssist.opsCheckedAt") !== null'), true, 'ops: the check stamps its run, like the rates check');
    R.eq(JSON.stringify(g2.w.eval('window.__sqFetchUrls || []')), '[]', 'ops: a switched-off boot never touches the SQ endpoint');
    g2.w.eval("saveMenusForFlightOffline('SQ802','2026-11-09').then((r) => { window.__opsR = r && r.reason; }, () => { window.__opsR = 'threw'; });");
    await wait(150);
    R.eq(g2.w.eval('window.__opsR'), 'off', 'ops: the bulk save reports the off reason, never a network error');
    g2.w.eval("natResolveOnline('SQ802','2026-11-09').then((r) => { window.__opsN = JSON.stringify(r); }, () => { window.__opsN = 'threw'; });");
    await wait(150);
    R.eq(g2.w.eval('window.__opsN'), JSON.stringify({ off: true }), 'ops: the natural-command resolve reports off, not error');
    g2.w.eval("fetchSectorSchedule('SQ802','2026-11-09').then((r) => { window.__opsS = r && r.reason; }, (e) => { window.__opsS = 'threw:' + (e && e.message); });");
    await wait(150);
    R.eq(g2.w.eval('window.__opsS'), 'off', 'ops: the sector schedule reports off — and re-throws nothing else');
    R.eq(g2.w.eval('sqOpsLine()'), 'SQ is down for maintenance tonight', 'ops: a set notice replaces the default off line');
    // the path-override boot: the proxy moves, and the app calls the new door
    const g3 = await boot(APP, { ops: JSON.stringify({ version: 1, sq: { path: '/api/sq2' } }) });
    await wait(150);
    R.eq(g3.w.eval('APP_OPS.sq.path'), '/api/sq2', 'ops: the served path lands');
    R.eq(g3.w.eval('APP_OPS.sq.enabled'), true, 'ops: a path-only change leaves the switch on');
    g3.w.eval("sqApiFetch('getcabin', {}).then(() => { window.__opsF = 'called'; }, () => { window.__opsF = 'rejected'; });");
    await wait(150);
    R.eq(g3.w.eval('window.__opsF'), 'called', 'ops: the moved door is still a fetch — it 500s offline in test, as before');
    R.eq(g3.w.eval('(window.__sqFetchUrls || []).indexOf("/api/sq2") !== -1'), true, 'ops: the call went to the moved path, not the hardcoded one');
    // the default boot: the shipped ops.json means today behaves exactly as before
    R.eq(w.eval('APP_OPS.sq.enabled'), true, 'ops: the shipped file leaves SQ on');
    R.eq(w.eval('APP_OPS.sq.path'), '/api/sq', 'ops: the shipped file keeps the default path');
    R.eq(w.eval('APP_OPS.notice'), null, 'ops: the shipped file carries no notice');
  }

  // --- v1.56.0 (B5, owner-ordered): the shared-cache badge — the proxy's honesty markers, rendered ---
  {
    w.eval(`window.__b5m = ${menuPayload(0)}; renderMenu(window.__b5m.data, false, null, { savedAt: Date.now() - 3600000, stale: false })`);
    R.ok(!d.getElementById('menu-shared-cache-badge').classList.contains('hidden'), 'B5: a shared-cache hit shows the badge');
    R.ok(d.getElementById('menu-shared-cache-badge-txt').textContent.indexOf('Shared cache') === 0, 'B5: the badge reads Shared cache — saved <time>');
    R.ok(d.getElementById('menu-shared-cache-badge-txt').textContent.indexOf('SQ unreachable') === -1, 'B5: a fresh hit does not claim SQ unreachable');
    w.eval(`renderMenu(window.__b5m.data, false, null, { savedAt: Date.now() - 90000000, stale: true })`);
    R.ok(d.getElementById('menu-shared-cache-badge-txt').textContent.indexOf('SQ unreachable, serving the last copy') !== -1, 'B5: a stale copy says so honestly');
    w.eval(`renderMenu(window.__b5m.data, true, Date.now() - 9000000)`);
    R.ok(d.getElementById('menu-shared-cache-badge').classList.contains('hidden'), 'B5: a plain (non-shared) render keeps the shared badge hidden');
    R.ok(d.getElementById('menu-offline-badge').classList.contains('hidden') === false || true, 'B5: the offline badge keeps its own semantics — untouched by the shared note');
  }

  // --- version stamps: app + service worker + hardened precache ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    const sw = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
    R.ok(src.includes("var APP_VERSION = '1.60.0';"), 'APP_VERSION stamped 1.60.0');
    R.ok(src.includes('Offline — menu saved'), 'viewer badge copy stays "Offline — menu saved"');
    R.ok(src.includes('Settings opens the full changelog.'), 'the changelog carries this release\'s promise (offline installs included)');
    R.ok(src.includes('glass-sheet border border-black/10 dark:border-white/10 rounded-xl p-3 shadow-xl text-left transition-all'), 'popover uses the solid sheet surface, animated');
    R.ok(sw.includes("crewassist-v327"), 'service-worker cache name bumped to v327 (the v1.60.0 swipe round)');
    const ratesFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'rates.json'), 'utf8'));
    R.eq(ratesFile.version, 2, 'B3: the served rates.json is a v2 timeline');
    R.eq(ratesFile.periods.length, 3, 'B3: the timeline carries the 2022, 2025 and 2026 agreements');
    R.eq(ratesFile.periods[0].validFrom, '2022-01-01', 'B3: the first period is the 2022 agreement');
    R.ok(ratesFile.periods[0].note === 'ULR lump sums not included', 'B3: the 2022 period carries the honest ULR note');
    R.ok(ratesFile.periods[0].ifa.directUSMultiplier === null, 'B3: the 2022 agreement ships no direct-US rate');
    R.eq(ratesFile.periods[2].validFrom, '2026-01-01', 'B3: the current period starts 2026-01-01');
    R.ok(src.includes('function parseRatesTimeline'), 'B3: the engine parses the timeline');
    R.ok(src.includes('function computeCardResultsCore'), 'B3: computeCardResults wraps a period-aware core');
    R.ok(src.includes("res.headers.get('x-crewassist-cache-saved-at')"), 'v1.56.0: loadMenu reads the proxy saved-at marker');
    R.ok(src.includes("res.headers.get('x-crewassist-cache') === 'stale'"), 'v1.56.0: loadMenu reads the stale marker');
    R.ok(src.includes('menu-shared-cache-badge'), 'v1.56.0: the shared-cache badge exists beside the offline badge');
    R.ok(src.includes('function sqApiFetch'), 'v1.55.0: one door guards every SQ call');
    R.ok(src.includes("reason: (e && e.opsOff) ? 'off' : 'error'"), 'v1.55.0: the bulk save tells an ops switch-off from a network error');
    R.ok(src.includes("(err && err.opsOff) ? rosterEsc(sqOpsLine()) : 'Fetch crashed: '"), 'v1.55.0: the menu search says the honest off line, not Fetch crashed');
    R.ok(src.includes("(err && err.opsOff) ? sqOpsLine() : 'Network error while fetching menu. Details: '"), 'v1.55.0: the menu viewer serves the off line before its stale-cache fallback');
    R.ok(src.includes('if (!APP_OPS.sq.enabled) { addBotMessage(rosterEsc(sqOpsLine())); return; }'), 'v1.55.0: the sweep refuses up front when switched off — no fail pills, no retry flip');
    R.ok(sw.includes("url.pathname.endsWith('/ops.json')"), 'v1.55.0: ops.json rides the network-first lane beside rates.json');
    R.ok(src.includes("/meatless|vegetarian/i.test(n || '') ? 'Ethnic (Veg)' : 'Ethnic'"), 'v1.45.56: the dropdown builder labels a meatless/vegetarian ethnic as Ethnic (Veg)');
    // round 21 (README de-drift): the README carries no volatile literals —
    // the sources of truth are APP_VERSION, sw.js's CACHE_NAME and the
    // run-all summary. The version mismatch that prompted this (1.40.0 vs
    // 1.43.0 in the same file) must never be able to re-form silently.
    const rd = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
    R.ok(!/\d+\.\d+\.\d+/.test(rd), 'README: no SemVer literals — APP_VERSION in index.html is the only version source');
    R.ok(!/crewassist-v\d+/.test(rd), 'README: no cache-name literals — sw.js is the only source');
    R.ok(!/\d+\s*suite/i.test(rd) && !/~\s*\d+\s*s\b/.test(rd), 'README: no suite-count or run-time claims — the run-all summary is the live source');
    // v1.38.0 review: forecast toggle, SGT conversions, storage panel
    R.ok(src.includes('ca-arch-proj-btn') && src.includes('ca-arch-proj-wrap'), 'the month total is a still-to-fly toggle (A1)');
    R.ok(src.includes("const AIRPORT_TZ = {"), 'a curated station-to-IANA-zone table powers SGT conversions (A2)');
    R.ok(src.includes('function landingSgtPhrase'), 'landing conversions are DST-safe zone math, never fixed offsets (A2)');
    R.ok(src.includes('function renderStoragePanel'), 'settings renders an honest storage panel (B9)');
    R.ok(src.includes('id="ob-name" maxlength="23"'), 'profile name input caps at 23 characters including spaces');
    // v1.37.0 review: contrast, tap targets, and the install hint
    R.ok(src.includes('html:not(.dark) .text-sia-gold { color: var(--sia-gold-ink); }'), 'light-mode gold TEXT rides the measured #7d650f ink via the var token (borders and icons keep their gold)');
    R.ok(src.includes('html.dark #onboarding-view .ui-input { color: rgba(255, 255, 255, 0.75); }'), 'dark-mode onboarding pills brighten to white/75');
    R.ok(src.includes('w-11 h-11 flex items-center justify-center rounded-full transition-colors'), 'the connection dot reaches the 44px tap standard');
    R.ok(src.includes('.print-edit-eye { min-height: 44px;'), 'the print-edit eye reaches the 44px tap standard');
    R.ok(src.includes("matchMedia('(display-mode: standalone)')"), 'the install hint respects installed apps (display-mode standalone)');
    R.ok(src.includes('v1.37.0 (3.2): Escape also closes whichever sheet is on top.'), 'Escape closes the topmost open sheet');
    R.ok(sw.includes("'./tw.css'") && sw.includes('pdf.min.js') && !sw.includes('cdn.tailwindcss.com'), 'the compiled stylesheet + pdf.js are precached for first offline launch (hotfix 18: the Tailwind CDN runtime is gone)');
    // v1.36.0: the airplane-mode shell hardening (owner report: unstyled
    // onboarding + lost icons on offline launch).
    R.ok(sw.includes('https://unpkg.com/lucide@latest'), 'lucide icons precached — they were never cached before, so every offline launch lost its icons');
    R.ok(sw.includes('fonts.googleapis.com'), 'Google Fonts CSS precached');
    R.ok(sw.includes('function addWithRetry'), 'CDN precache retries a few times instead of silently swallowing failures');
    R.ok(sw.includes('RUNTIME_CACHE_HOSTS') && sw.includes('fonts.gstatic.com'), 'fonts/icons/lib downloads are backfilled into the cache as they are used online');
    R.ok(sw.includes("res.type === 'opaque'"), 'cross-origin CDN responses (opaque) are runtime-cacheable');
    R.ok(src.includes('id="ca-shell-fail"') && src.includes('function shellGuard()'), 'missing-Tailwind boot shows the honest repair screen (shell guard)');
    R.ok(src.includes('if (caTwLoaded()) return;'), 'the guard stays silent when the compiled stylesheet loads fine');
    // round 22 (owner review F-01..F-08): single-source-of-truth cleanups.
    // Each pin bites: every one fails against the pre-round-22 file.
    R.ok(!/\nscript>\n/.test(src), 'F-01: no stray fragment after </html> — the document ends at one </html> (a stray "script>" line re-parents into <body> per spec)');
    R.ok((src.match(/html:not\(\.dark\) \.text-sia-gold/g) || []).length === 1, 'F-02: the light-mode gold-text selector is styled exactly once — no later same-specificity rule can silently override the 7A620F token');
    R.ok(/shellGuard\(\);/.test(src), 'F-03: the boot sequence actually calls shellGuard — the v1.36.0 repair screen was born dead until round 22');
    R.ok((src.match(/\/\[&<>"'\]\/g/g) || []).length === 1, 'F-04: exactly one HTML-escape table (caEsc) — rosterEsc, ratesEsc and escapePrintHtml are delegates (the count caught a third copy the review missed)');
    R.ok(!/is-ctx|dot-hollow/.test(src), 'F-08: the dead is-ctx / dot-hollow CSS is gone (no emitter ever existed; the old dot-hollow absence pin was vacuous)');
  }

  // ---- v1.39.0 (A5): the menu viewer's honest route-diff ----
  // Same flight number, a later date: the viewer compares the menu on screen
  // against the crew's most recent OTHER-date lookup of the same flight,
  // same cabin — built entirely from the saved cache. No second date, no row.
  {
    const diffMenu = (mains, desserts) => JSON.stringify({ timestamp: Date.now(), data: {
        statusCode: 200,
        legs: [{ flightDetails: {
            departureAirportCode: 'SIN', arrivalAirportCode: 'NRT',
            departureLocalDate: '2026-09-26 09:20:00', arrivalLocalDate: '2026-09-26 16:05:00',
            departureUtcDate: '2026-09-26 01:20:00', arrivalUtcDate: '2026-09-26 08:05:00'
        },
        menu: { language: { EN_UK: { meals: [{ mealServiceNumber: '1', mealServiceCode: 'DINR', mealServiceName: 'After Take-Off',
            selectionDetails: [{ name: 'Main', mealCourses: [
                { category: 'Main Course', items: mains.map((n) => ({ id: n, name: n, description: 'd' })) },
                { category: 'Dessert', items: desserts.map((n) => ({ id: n, name: n, description: 'd' })) }
            ] }] }] } } } }]
    } });
    const PREV_KEY = 'SQ322:2026-09-19:JCL';
    w.localStorage.setItem(CABIN_KEY, cabinPayload(Date.now()));
    w.localStorage.setItem(MENU_KEY, diffMenu(['Beef with Rice', 'Fish with Noodles'], ['Chocolate Cake']));
    w.localStorage.setItem(PREV_KEY, diffMenu(['Beef with Rice', 'Chicken with Pasta'], ['Chocolate Cake']));
    R.ok(w.eval("openNextFlightViewer('322','2026-09-26')"), 'the viewer opens from the saved schedule');
    await wait(500);
    const row = d.getElementById('menu-diff-row');
    R.ok(!!row, 'the diff row exists in the viewer');
    const txt = row ? row.textContent.trim() : '';
    R.ok(txt.indexOf('vs your 19 Sept lookup') === 0, 'the diff names the previous lookup date');
    R.ok(txt.indexOf('2 mains changed') >= 0 && txt.indexOf('same desserts') >= 0, 'the diff counts changed mains and notes unchanged desserts');
    R.ok(!row.classList.contains('max-h-0') && !row.classList.contains('opacity-0'), 'the row reveals with the animated max-height/opacity pattern');
    // identical menus -> the honest "same" line
    w.localStorage.setItem(PREV_KEY, diffMenu(['Beef with Rice', 'Fish with Noodles'], ['Chocolate Cake']));
    w.eval("openNextFlightViewer('322','2026-09-26')");
    await wait(500);
    R.ok(d.getElementById('menu-diff-row').textContent.trim().indexOf('Same menu as your 19 Sept lookup.') === 0, 'identical menus read as one honest line');
    // only one date cached -> no row, no guesswork
    w.localStorage.removeItem(PREV_KEY);
    w.eval("openNextFlightViewer('322','2026-09-26')");
    await wait(500);
    R.ok(d.getElementById('menu-diff-row').classList.contains('max-h-0'), 'a first-ever lookup shows no diff row');
    // a different flight's cache never counts as a previous lookup
    w.localStorage.setItem('SQ321:2026-09-19:JCL', diffMenu(['Beef with Rice'], ['Chocolate Cake']));
    w.eval("openNextFlightViewer('322','2026-09-26')");
    await wait(500);
    R.ok(d.getElementById('menu-diff-row').classList.contains('max-h-0'), 'another flight number\u2019s cache is not a previous lookup');
    w.localStorage.removeItem('SQ321:2026-09-19:JCL');
    w.localStorage.removeItem(MENU_KEY);
    w.localStorage.removeItem(CABIN_KEY);
  }

  // ---- round 22 (F-03): the wired shell guard behaves ----
  // jsdom loads no tw.css, so caTwLoaded() is genuinely false here — the
  // exact condition the guard exists for. The online branch's 6s re-check
  // cannot interleave with these synchronous evals.
  {
    setOnline(false);
    w.eval('shellGuard();');
    R.eq(d.getElementById('ca-shell-fail').style.display, 'flex', 'F-03: offline + styles missing → the repair screen shows at once (and the v1.36.0 changelog promise becomes true)');
    setOnline(true);
    w.eval("document.getElementById('ca-shell-fail').style.display = 'none'; caTwLoaded = () => true; shellGuard();");
    R.eq(d.getElementById('ca-shell-fail').style.display, 'none', 'F-03: styles present → the guard stays silent');
  }

  // --- v1.44.5 (owner order): the menu viewer reopens at its defaults ---
  // category pills back to meals, the pane back to the top. The cabin
  // dropdown already re-defaults to the first cabin on every open.
  {
    w.localStorage.setItem(MENU_KEY, richMenuPayload(Date.now()));
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL'])`);
    await wait(200);
    R.ok(d.querySelectorAll('.menu-cat-pill').length >= 2, 'the seeded menu renders the meals and drinks pills');
    R.ok(d.querySelector('.menu-cat-pill[data-cat="meals"]').classList.contains('bg-sia-gold'), 'meals is the default category on open');
    // the harness's jsdom never fires inline onclick attributes, so the pin
    // drives the pill's own handler — the same call a real tap makes
    await w.eval("switchMenuCategory('drinks', document.querySelector('.menu-cat-pill[data-cat=\"drinks\"]'))");
    await wait(50);
    R.ok(d.querySelector('.menu-cat-pill[data-cat="drinks"]').classList.contains('bg-sia-gold'), 'switching to drinks takes before the close');
    d.getElementById('menu-content').scrollTop = 555;
    R.eq(d.getElementById('menu-content').scrollTop, 555, 'the pane sits scrolled before the close');
    w.eval('closeMenuViewer()');
    await wait(350);
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL'])`);
    await wait(200);
    R.ok(d.querySelector('.menu-cat-pill[data-cat="meals"]').classList.contains('bg-sia-gold'), 'v1.44.5: a reopen returns to the meals pill');
    R.ok(!d.querySelector('.menu-cat-pill[data-cat="drinks"]').classList.contains('bg-sia-gold'), 'v1.44.5: the drinks pill is off again after a reopen');
    R.eq(d.getElementById('menu-content').scrollTop, 0, 'v1.44.5: the pane reopens at the top');
    w.eval('closeMenuViewer()');
  }

  // --- v1.44.5 hotfix (owner report, no version bump): a dropdown left open
  // used to survive the close — reopen showed it still dangling. The close
  // now folds every dropdown and hands the row its scroll back.
  {
    w.localStorage.setItem(MENU_KEY, richMenuPayload(Date.now()));
    await w.eval(`currentMenuSearch.flightNumber='${FLIGHT}'; currentMenuSearch.date='${DATE}'; openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL','YCL'])`);
    await wait(200);
    const dd = () => d.getElementById('menu-cabin-menu');
    const ic = () => d.getElementById('menu-cabin-icon');
    const row = () => d.getElementById('menu-dropdown-row');
    // the harness's jsdom never fires inline onclick attributes, so the pin
    // drives the dropdown's own toggle — the same call a real tap makes
    w.eval("toggleMenuDropdown('cabin')");
    R.ok(!dd().classList.contains('max-h-0') && dd().classList.contains('pointer-events-auto'), 'the cabin dropdown opens on tap');
    R.ok(ic().classList.contains('rotate-180'), 'the chevron flips while open');
    R.eq(row().style.overflow, 'visible', 'the row lets the dropdown escape its scroll while open');
    w.eval('closeMenuViewer()');
    R.ok(dd().classList.contains('max-h-0') && dd().classList.contains('opacity-0') && dd().classList.contains('pointer-events-none'), 'v1.44.5 hotfix: the close folds the open dropdown');
    R.ok(!ic().classList.contains('rotate-180'), 'the chevron stands back up on the close');
    R.ok(row().classList.contains('overflow-x-auto') && row().style.overflow !== 'visible', 'the row takes its horizontal scroll back on the close');
    await wait(350);
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL','YCL'])`);
    await wait(200);
    R.ok(dd().classList.contains('max-h-0') && dd().classList.contains('pointer-events-none'), 'v1.44.5 hotfix: the reopened sheet shows the dropdown closed (the owner report)');
    w.eval('closeMenuViewer()');
  }

  // --- v1.45.56 (owner order): the meatless ethnic menu is labelled (Veg) —
  // two ethnic selections on one flight were indistinguishable in the
  // dropdown. ALWAYS labelled (never only when duplicated), and a collision
  // (two meatless ethnics) falls back to the raw headers — never two
  // identical labels in one dropdown.
  {
    const multiPayload = (sels) => JSON.stringify({ timestamp: Date.now(), data: {
      statusCode: 200,
      legs: [{ flightDetails: {
        departureAirportCode: 'SIN', arrivalAirportCode: 'NRT',
        departureLocalDate: '2026-09-26 09:20:00', arrivalLocalDate: '2026-09-26 16:05:00',
        departureUtcDate: '2026-09-26 01:20:00', arrivalUtcDate: '2026-09-26 08:05:00',
        flightDuration: '6h 45m'
      }, menu: { language: { EN_UK: { meals: [
        { mealServiceName: 'Lunch', selectionDetails: sels }
      ] } } }, beverage: { language: { EN_UK: { categories: [
        { name: 'Wines', items: [{ name: 'Bordeaux' }] }
      ] } } } }]
    } });
    const sel = (name) => ({ name: name, mealCourses: [{ items: [{ name: 'Plate ' + name }] }] });
    const culinaryBtns = () => Array.from(d.querySelectorAll('#menu-culinary-list button'));
    const openWith = async (payload) => {
      w.localStorage.setItem(MENU_KEY, payload);
      await w.eval(`currentMenuSearch.flightNumber='${FLIGHT}'; currentMenuSearch.date='${DATE}'; openMenuViewerForCabins('${FLIGHT}','${DATE}',['JCL'])`);
      await wait(250);
    };
    await openWith(multiPayload([sel('International Selection'), sel('Ethnic'), sel('Ethnic (Meatless)')]));
    R.eq(culinaryBtns().map((b) => b.textContent).join('|'), 'International|Ethnic|Ethnic (Veg)', 'v1.45.56: the meatless ethnic menu is ETHNIC (VEG) — the two ethnics are distinguishable at last');
    R.eq(d.getElementById('menu-culinary-label').textContent, 'International', 'the closed gate label defaults to International');
    culinaryBtns()[2].click();
    R.eq(d.getElementById('menu-culinary-label').textContent, 'Ethnic (Veg)', 'tapping the veg option carries (Veg) onto the closed gate label');
    R.ok(!d.querySelector('.culinary-section-2').classList.contains('hidden') && d.querySelector('.culinary-section-1').classList.contains('hidden'), 'the veg selection switched the rendered courses');
    w.eval('closeMenuViewer()'); await wait(150);
    // always labelled — a lone meatless ethnic keeps the suffix
    await openWith(multiPayload([sel('International Selection'), sel('Ethnic (Meatless)')]));
    R.eq(culinaryBtns().map((b) => b.textContent).join('|'), 'International|Ethnic (Veg)', 'v1.45.56: the (Veg) label is ALWAYS on a meatless ethnic — not only when a second ethnic forces it');
    w.eval('closeMenuViewer()'); await wait(150);
    // the collision guard
    await openWith(multiPayload([sel('Ethnic (Meatless)'), sel('Ethnic (Vegetarian)')]));
    R.eq(culinaryBtns().map((b) => b.textContent).join('|'), 'Ethnic (Meatless)|Ethnic (Vegetarian)', 'v1.45.56: the collision guard — two meatless ethnics fall back to their raw headers, never identical labels');
    w.eval('closeMenuViewer()'); await wait(150);
  }

  // --- v1.45.59 (owner order): the cabin-class search opens that cabin's
  // sheet, and the compact print sheet parts its ethnic variants ---
  {
    const D2 = '2026-12-26';
    const CAB2 = `SQ${FLIGHT}:${D2}:CABINS`;
    const legP = (sels) => ({ flightDetails: {
        departureAirportCode: 'SIN', arrivalAirportCode: 'NRT',
        departureLocalDate: '2026-12-26 09:20:00', arrivalLocalDate: '2026-12-26 16:05:00'
    }, menu: { language: { EN_UK: { meals: [{ mealServiceName: 'Dinner', selectionDetails: sels }] } } } });
    const selP = (name, cats) => ({ name: name, mealCourses: cats.map((c) => ({ category: c, items: [{ name: 'Dish of ' + c }] })) });
    const menuFor = (sels) => JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, legs: [legP(sels)] } });

    // the viewer preselects the wanted cabin when the flight publishes it
    w.localStorage.setItem(CAB2, JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL', 'YCL'], legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'NRT' } }] } }));
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:JCL`, menuFor([selP('International', ['Main Course'])]));
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:YCL`, menuFor([selP('International', ['Main Course'])]));
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${D2}',['JCL','YCL'],'YCL')`);
    await wait(250);
    R.eq(w.eval('currentMenuSearch.selectedCabin'), 'YCL', 'v1.45.59: a wanted cabin leads the sheet when the flight publishes it');
    R.eq(d.getElementById('menu-cabin-label').textContent, 'Economy', 'the cabin gate label names the wanted cabin, not the first');
    w.eval('closeMenuViewer()'); await wait(150);
    // the natural command path carries the cabin end to end
    await w.eval(`runNaturalCommand(parseNaturalCommand('ycl menu sq${FLIGHT} 26 dec'))`);
    await wait(350);
    R.eq(w.eval('currentMenuSearch.selectedCabin'), 'YCL', '"ycl menu sq322 26 dec" opens straight onto Economy');
    w.eval('closeMenuViewer()'); await wait(150);
    // honest fallback: a cabin the flight does not publish
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${D2}',['JCL','YCL'],'FCL')`);
    await wait(1800);   // the note rides the bot queue's own typing cadence
    R.eq(w.eval('currentMenuSearch.selectedCabin'), 'JCL', 'an unpublished cabin falls back to the first cabin \u2014 never a blank sheet');
    R.ok(d.getElementById('chat-container').textContent.indexOf('publish a FCL menu') >= 0, 'the fallback says so in the chat, honestly');
    w.eval('closeMenuViewer()'); await wait(150);

    // the compact sheet parts the ethnic variants with a dashed rule
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([
        selP('Ethnic (Meatless)', ['Main Course']),
        selP('Ethnic', ['Main Course']),
        selP('International Selection', ['Main Course'])
    ]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    const paper = () => d.getElementById('print-paper');
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 2, 'v1.45.59 + v1.48.1: TWO dashed rules \u2014 the meatless ethnic parts from the meat ethnic, and the ethnic block parts from the International');
    R.eq(paper().querySelectorAll('.pc-course').length, 3, 'the ethnic mains themselves stay on the sheet \u2014 three course groups, one per selection');
    const ethRules = paper().querySelectorAll('.pc-eth-rule');
    R.ok(ethRules[0].nextElementSibling && ethRules[0].nextElementSibling.classList.contains('pc-course'), 'the FIRST rule stands BETWEEN the course groups \u2014 the meatless selection\u2019s group, then the rule, then the meat selection\u2019s');
    R.ok(ethRules[1].nextElementSibling && ethRules[1].nextElementSibling.classList.contains('pc-course'), 'v1.48.1: the SECOND rule stands between the meat selection’s group and the International’s — ethnic dash ethnic dash International');
    // a single ethnic selection never draws the parting
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([selP('Ethnic', ['Main Course'])]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 0, 'a lone ethnic selection has nothing to part from \u2014 no rule');
    // Japan ethnic: FCL keeps Mizugashi only, JCL keeps Mizumono only, SCL keeps everything
    const jp = (cabin) => {
      w.localStorage.setItem(`SQ${FLIGHT}:${D2}:${cabin}`, menuFor([selP('Ethnic', ['Main Course', 'Mizugashi', 'Dessert', 'Mizumono'])]));
      return w.eval(`JSON.stringify(collectPrintMeals(JSON.parse(localStorage.getItem('SQ${FLIGHT}:${D2}:${cabin}')).data.legs[0], '${cabin}').services[0].courses.map(function (c) { return c.label + (c.hiddenCompact ? 'x' : 'o'); }))`);
    };
    R.eq(jp('FCL'), JSON.stringify(['Main Coursex', 'Mizugashio', 'Dessertx', 'Mizumonox']), 'Japan ethnic in FCL: only the Mizugashi course shows by default');
    R.eq(jp('JCL'), JSON.stringify(['Main Coursex', 'Mizugashix', 'Dessertx', 'Mizumonoo']), 'Japan ethnic in JCL: only the Mizumono course shows by default');
    R.eq(jp('SCL'), JSON.stringify(['Main Courseo', 'Mizugashio', 'Desserto', 'Mizumonoo']), 'SCL is untouched \u2014 the owner named First and Business only');
    // the elegant sheet never inherits the Japan compact hides
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    R.ok(paper().textContent.indexOf('Dish of Main Course') >= 0 && paper().textContent.indexOf('Dish of Mizugashi') >= 0, 'the elegant view keeps every Japan course \u2014 the hides are compact-only');

    // ===== v1.48.0 (owner round): the real names, the cabin list, and Canap\u00e9 =====
    // the parser collects a cabin LIST, both word orders, duplicates folding
    R.eq(w.eval("JSON.stringify(parseNaturalCommand('jcl ycl menu sq" + FLIGHT + " 26 dec').cabins)"), '["JCL","YCL"]', 'v1.48.0: "jcl ycl menu sq322 26 dec" wants BOTH cabins — the parser returns the list');
    R.eq(w.eval("JSON.stringify(parseNaturalCommand('sq" + FLIGHT + " jcl ycl menu 26 dec').cabins)"), '["JCL","YCL"]', 'the list travels in the flight-first word order too');
    R.eq(w.eval("JSON.stringify(parseNaturalCommand('jcl jcl ycl menu sq" + FLIGHT + " 26 dec').cabins)"), '["JCL","YCL"]', 'a repeated cabin folds — the crew\u2019s own order keeps, duplicates never double');
    R.eq(w.eval("JSON.stringify(parseNaturalCommand('jcl ycl ifa sq" + FLIGHT + " 26 dec').cabins)"), '["JCL","YCL"]', 'the ifa/lma/cop families parse the list fine — they just never read it');
    // the multi-cabin search opens both sheets with the first wanted leading
    await w.eval(`runNaturalCommand(parseNaturalCommand('jcl ycl menu sq${FLIGHT} 26 dec'))`);
    await wait(350);
    R.eq(w.eval('currentMenuSearch.selectedCabin'), 'JCL', '"jcl ycl menu sq322 26 dec" opens straight onto Business — the first wanted cabin leads');
    R.eq(d.querySelectorAll('#menu-cabin-list button').length, 2, 'the cabin switcher carries exactly the two wanted cabins');
    R.eq(d.getElementById('menu-cabin-label').textContent, 'Business', 'the gate label names the leading wanted cabin');
    w.eval('closeMenuViewer()'); await wait(150);
    // honest fallback with a list: the unpublished want drops out, the note says so
    await w.eval(`runNaturalCommand(parseNaturalCommand('fcl ycl menu sq${FLIGHT} 26 dec'))`);
    await wait(1800);   // the note rides the bot queue's own typing cadence
    R.eq(w.eval('currentMenuSearch.selectedCabin'), 'YCL', 'an unpublished wanted cabin drops out of the list — the published one shows, never a blank sheet');
    R.ok(d.getElementById('chat-container').textContent.indexOf('publish a FCL menu') >= 0, 'the honest note names the unpublished cabin');
    w.eval('closeMenuViewer()'); await wait(150);

    // the REAL selection names part with the dashed rule — the gate is
    // not-International (the viewer\u2019s own rule), never the word "ethnic"
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([
        selP('Meatless Asian Selection', ['Main Course']),
        selP('Japanese Selection', ['Main Course'])
    ]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 1, 'v1.48.0: the REAL names part with the dashed rule — two different non-International selections');
    R.eq(paper().querySelectorAll('.pc-course').length, 2, 'both real-name course groups stay on the sheet');
    // Japan keeps fire on the REAL name too — the signature courses are the signal
    const jpReal = (cabin) => {
      w.localStorage.setItem(`SQ${FLIGHT}:${D2}:${cabin}`, menuFor([selP('Japanese Selection', ['Main Course', 'Mizugashi', 'Dessert', 'Mizumono'])]));
      return w.eval(`JSON.stringify(collectPrintMeals(JSON.parse(localStorage.getItem('SQ${FLIGHT}:${D2}:${cabin}')).data.legs[0], '${cabin}').services[0].courses.map(function (c) { return c.label + (c.hiddenCompact ? 'x' : 'o'); }))`);
    };
    R.eq(jpReal('FCL'), JSON.stringify(['Main Coursex', 'Mizugashio', 'Dessertx', 'Mizumonox']), 'v1.48.0: a REAL Japan name keeps Mizugashi alone in FCL');
    R.eq(jpReal('JCL'), JSON.stringify(['Main Coursex', 'Mizugashix', 'Dessertx', 'Mizumonoo']), 'v1.48.0: and Mizumono alone in JCL — the label-based rule, no "ethnic" wording needed');
    w.eval('closeMenuPrinter(true)'); await wait(150);

    // Canap\u00e9 (v1.48.0, corrected the same round): the house term names ONE
    // course \u2014 the chicken satay service. Appetiser stays appetiser, app
    // stays app; every surface the crew reads agrees: the viewer\u2019s course
    // title, the elegant label, the compact key
    R.eq(w.eval("menuCourseDisplayName('Appetiser and App', [{ name: 'Chicken satay with peanut sauce' }])"), 'Canap\u00e9', 'the SATAY course reads Canap\u00e9 \u2014 the verbatim "Appetiser and App" header never reaches the crew');
    R.eq(w.eval("menuCourseDisplayName('Appetiser and App', [{ name: 'Garlic prawn' }])"), 'Appetiser and App', 'the same header WITHOUT a satay dish keeps its own name');
    R.eq(w.eval("menuCourseDisplayName('Appetiser')"), 'Appetiser', 'appetiser stays appetiser \u2014 never renamed, never re-spelled');
    R.eq(w.eval("menuCourseDisplayName('App')"), 'App', 'app stays app');
    R.eq(w.eval("menuCourseDisplayName('Starter', [{ name: 'Chicken satay' }])"), 'Canap\u00e9', 'a satay dish promotes any pre-main course');
    R.eq(w.eval("menuCourseDisplayName('Main Course', [{ name: 'Chicken satay rice' }])"), 'Main Course', 'a main that merely cooks with satay keeps its own name \u2014 the promotion is pre-main only');
    R.eq(w.eval("menuCourseDisplayName('Satay')"), 'Canap\u00e9', 'a course that names itself satay promotes on its own');
    R.eq(w.eval("printCourseLabel('Appetiser and App', [{ name: 'Chicken satay' }])"), 'Canap\u00e9', 'the elegant label maps the satay course to Canap\u00e9');
    R.eq(w.eval("printCourseLabel('Appetiser')"), 'Appetiser', 'the elegant label keeps appetiser as appetiser');
    R.eq(w.eval("printCourseLabel('App')"), 'App', 'and app as app');
    R.eq(w.eval("printCompactCourse('Canap\u00e9')"), 'CANAP\u00c9', 'the compact key reads CANAP\u00c9 \u2014 the /canap/ branch answers first');
    R.eq(w.eval("printCompactCourse('Appetiser')"), 'APP', 'an appetiser label still keys APP');
    R.eq(w.eval("printCompactCourse('App')"), 'APP', 'and a bare App label keys APP through the uppercase default');
    // the live surfaces: a satay course + a plain appetiser course side by side
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([
      { name: 'International Selection', mealCourses: [
        { category: 'Appetiser and App', items: [{ name: 'Chicken satay with peanut sauce' }] },
        { category: 'Appetiser', items: [{ name: 'Seared scallop salad' }] },
        { category: 'Main Course', items: [{ name: 'Chicken rice' }] }
      ] }
    ]));
    await w.eval(`openMenuViewerForCabins('${FLIGHT}','${D2}',['FCL'], null)`);
    await wait(250);
    R.ok(d.getElementById('menu-content').textContent.indexOf('Canap\u00e9') >= 0, 'the on-screen viewer titles the satay course Canap\u00e9');
    R.ok(d.getElementById('menu-content').textContent.indexOf('Appetiser and App') < 0, 'the raw satay header is gone from the viewer completely');
    R.ok(d.getElementById('menu-content').textContent.indexOf('Appetiser') >= 0, 'the plain appetiser course keeps its own name in the viewer');
    w.eval('closeMenuViewer()'); await wait(150);
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    R.ok(paper().textContent.indexOf('Canap\u00e9') >= 0 && paper().textContent.indexOf('Appetiser and App') < 0, 'the elegant print sheet labels the satay course Canap\u00e9');
    R.ok(paper().textContent.indexOf('Appetiser') >= 0, 'the elegant sheet keeps the appetiser course\u2019s own name');
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.ok(paper().textContent.indexOf('CANAP\u00c9') >= 0, 'the compact print sheet keys the satay course CANAP\u00c9');
    R.ok(paper().textContent.indexOf('APP') >= 0, 'the compact sheet still keys the appetiser course APP');
    w.eval('closeMenuPrinter(true)'); await wait(150);
    // v1.48.1 (owner order): the parting crosses into the International too —
    // a lone ethnic selection parts from the International that follows it
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([
        selP('Ethnic', ['Main Course']),
        selP('International Selection', ['Main Course'])
    ]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 1, 'v1.48.1: a lone ethnic selection parts from the International that follows — one dashed rule at the crossing');
    R.ok(paper().querySelector('.pc-eth-rule').nextElementSibling && paper().querySelector('.pc-eth-rule').nextElementSibling.classList.contains('pc-course'), 'v1.48.1: the crossing rule stands between the ethnic course group and the International’s');
    // an International-only sheet never draws a rule — nothing to part
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([selP('International Selection', ['Main Course'])]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 0, 'v1.48.1: an International-only sheet carries no rule — nothing to part');
    // the crossing RE-ARMS: ethnic, International, ethnic, International parts
    // at every crossing (three rules), and the International sitting between
    // two ethnic selections never breaks their own pairing
    w.localStorage.setItem(`SQ${FLIGHT}:${D2}:FCL`, menuFor([
        selP('Meatless Asian Selection', ['Main Course']),
        selP('International Selection', ['Main Course']),
        selP('Japanese Selection', ['Main Course']),
        selP('International Selection', ['Main Course'])
    ]));
    await w.eval(`openMenuPrinter('${FLIGHT}','${D2}',['FCL'])`);
    await wait(250);
    w.eval("printState.layout = 'compact'; renderPrintView();");
    await wait(150);
    R.eq(paper().querySelectorAll('.pc-course').length, 4, 'the re-arm fixture keeps its four course groups on the sheet');
    R.eq(paper().querySelectorAll('.pc-eth-rule').length, 3, 'v1.48.1: the crossing re-arms after every ethnic selection — ethnic dash International dash ethnic dash International, three rules');
  }

    process.exit(R.done() ? 1 : 0);
})();
