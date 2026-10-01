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

  // --- the status dot + capability popover ---
  {
    setOnline(true);
    w.eval('updateNetStatus()');
    const core = d.getElementById('net-status-dot-core');
    R.ok(core.className.includes('bg-green-500') && core.className.includes('animate-pulse'), 'online dot pulses green');
    setOnline(false);
    w.dispatchEvent(new w.Event('offline'));
    R.ok(core.className.includes('bg-amber-500') && !core.className.includes('animate-pulse'), 'offline event turns the dot steady amber');
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
    R.ok(src.includes("var APP_VERSION = '1.35.0';"), 'APP_VERSION stamped 1.35.0');
    R.ok(src.includes('Offline — menu saved'), 'viewer badge copy stays "Offline — menu saved"');
    R.ok(src.includes('Settings opens the full changelog.'), 'the changelog carries this release\'s promise (offline installs included)');
    R.ok(src.includes('glass-sheet border border-black/10 dark:border-white/10 rounded-xl p-3 shadow-xl text-left transition-all'), 'popover uses the solid sheet surface, animated');
    R.ok(sw.includes("crewassist-v166"), 'service-worker cache name bumped to v166');
    R.ok(sw.includes('https://cdn.tailwindcss.com') && sw.includes('pdf.min.js'), 'Tailwind + pdf.js precached for first offline launch');
  }

    process.exit(R.done() ? 1 : 0);
})();
