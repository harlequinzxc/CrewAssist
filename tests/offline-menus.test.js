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

  // --- version stamps: app + service worker + hardened precache ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    const sw = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
    R.ok(src.includes("var APP_VERSION = '1.45.12';"), 'APP_VERSION stamped 1.45.12');
    R.ok(src.includes('Offline — menu saved'), 'viewer badge copy stays "Offline — menu saved"');
    R.ok(src.includes('Settings opens the full changelog.'), 'the changelog carries this release\'s promise (offline installs included)');
    R.ok(src.includes('glass-sheet border border-black/10 dark:border-white/10 rounded-xl p-3 shadow-xl text-left transition-all'), 'popover uses the solid sheet surface, animated');
    R.ok(sw.includes("crewassist-v243"), 'service-worker cache name bumped to v243 (the v1.45.12 earnings-polish release)');
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

    process.exit(R.done() ? 1 : 0);
})();
