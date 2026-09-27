// Next-flight awareness (v1.28.0): the roster import remembers upcoming
// flights (positioning duties excluded), the greeting shows a tappable
// next-flight card, and an amber nudge offers to save menus for flights
// departing inside the 48h window before you lose signal.
const H = require('./_harness');
const { R, boot, wait, APP } = H;

const DAY = 86400000;
function ymd(off) {
  const d = new Date(Date.now() + off * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function mkStore(list) {
  const o = {};
  list.forEach((f) => { (o[f.ymd.slice(0, 7)] = o[f.ymd.slice(0, 7)] || []).push(f); });
  return o;
}
// cached-menu shapes (same family as the offline-menus suite)
const cabinPayload = JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL', 'YCL'], legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'CDG' } }] } });
const menuPayloadData = JSON.stringify({ statusCode: 200, legs: [{ flightDetails: { departureAirportCode: 'SIN', arrivalAirportCode: 'CDG', departureLocalDate: '2026-09-27 23:15:00', arrivalLocalDate: '2026-09-28 06:05:00', departureUtcDate: '2026-09-27 15:15:00', arrivalUtcDate: '2026-09-27 22:05:00', flightDuration: '6h 50m' } }] });
const menuPayload = JSON.stringify({ timestamp: Date.now(), data: JSON.parse(menuPayloadData) });

const seedProfile = (w) => {
  // a settled returning device: onboarded, tour already offered/done
  w.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
  w.localStorage.setItem('crewAssist.tourOffered', '1');
  w.localStorage.setItem('crewAssist.tourDone', '1');
};
const waitChatIdle = async (w, cap) => {
  const end = Date.now() + (cap || 12000);
  while (Date.now() < end) {
    if (!w.eval('isChatBusy()')) return true;
    await wait(250);
  }
  return !w.eval('isChatBusy()');
};

// Real-geometry synthetic table page: a rotated crew roster — day columns
// keyed by x, date anchors along the bottom, flight/sector/std/sta/pos values
// at the same x (shapes taken from the real _inbox rosters).
function rosterItems(flight, sector, dateTok, opts) {
  opts = opts || {};
  const x = opts.x || 950, page = 1;
  const its = [
    { str: dateTok, x: x, y: 21, page: page },          // date anchor column
    { str: 'SQ ' + flight, x: x, y: 91, page: page },   // flight number row
    { str: sector, x: x, y: 134, page: page },          // sector row
    { str: 'Rpt', x: 200, y: 331, page: page }, { str: '0555', x: x, y: 331, page: page },
    { str: 'STD', x: 200, y: 359, page: page }, { str: '0755', x: x, y: 359, page: page },
    { str: 'STA', x: 200, y: 390, page: page }, { str: '1319', x: x, y: 390, page: page }
  ];
  if (opts.posCode) its.push({ str: opts.posCode, x: x, y: 254, page: page }); // pairing duty code line
  if (opts.tvl) its.push({ str: 'TVL', x: x, y: 211, page: page });             // duty row
  return its;
}

(async () => {
  // --- parser: positioning duty codes tag the flight ---
  {
    const { w } = await boot(APP);
    const tagged = w.eval('rosterParse(' + JSON.stringify(rosterItems('828', 'SIN-PVG', '17Apr25', { posCode: 'PU', tvl: true })) + ')');
    R.ok(tagged.flights.length === 1, 'positioning sector with times parses as a flight');
    R.ok(tagged.flights[0].pos === true, 'PU pairing code tags the flight as positioning');
    const pn = w.eval('rosterParse(' + JSON.stringify(rosterItems('298', 'CHC-SIN', '05Feb26', { posCode: 'PN', tvl: true })) + ')');
    R.ok(pn.flights[0].pos === true, 'PN (civilian positioning) tags too');
    const du = w.eval('rosterParse(' + JSON.stringify(rosterItems('366', 'SIN-FCO', '13Oct24', { posCode: 'DU' })) + ')');
    R.ok(du.flights[0].pos === true, 'DU (deadheading) tags too');
    const dutyOnly = w.eval('rosterParse(' + JSON.stringify(rosterItems('810', 'SIN-FCO', '12Oct24', { tvl: true })) + ')');
    R.ok(dutyOnly.flights[0].pos === true, 'a bare TVL duty row tags too');
    const clean = w.eval('rosterParse(' + JSON.stringify(rosterItems('336', 'SIN-CDG', '01Jun25', {})) + ')');
    R.ok(clean.flights[0].pos === false, 'an ordinary operating flight is not tagged');
  }

  // --- store: prune the past, replace the month, drop positioning, dedupe ---
  {
    const { w } = await boot(APP);
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify({ '2020-01': [{ fn: '1', dep: 'SIN', arr: 'AAA', ymd: '2020-01-05', std: '0100' }] }));
    const parsed = { flights: [
      { fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0000', stdHm: '0000', pos: false },
      { fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0000', stdHm: '0000', pos: false },
      { fn: '828', dep: 'SIN', arr: 'PVG', ymd: ymd(3), std: '0755', stdHm: '0755', pos: true }
    ] };
    w.eval('upcomingRemember(' + JSON.stringify(parsed) + ')');
    const saved = JSON.parse(w.localStorage.getItem('crewAssist.upcoming'));
    R.ok(!saved['2020-01'], 'past months are pruned');
    const mk = ymd(1).slice(0, 7);
    R.ok(saved[mk] && saved[mk].length === 1, 'dedupe + month replace on re-import');
    R.ok(saved[mk][0].fn === '336' && !saved[mk].some((f) => f.fn === '828'), 'positioning flights are not remembered');
  }

  // --- boot: the card under the greeting ---
  {
    const { d } = await boot(APP, { seed: seedProfile });
    await wait(5600);
    R.ok(!d.getElementById('ca-nextflight-card'), 'profile but no roster → no card, no empty state');
  }
  {
    // saved menus -> tap opens the cached viewer directly (works offline)
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
      x.localStorage.setItem('SQ336:' + ymd(1) + ':CABINS', cabinPayload);
      x.localStorage.setItem('SQ336:' + ymd(1) + ':JCL', menuPayload);
      x.localStorage.setItem('SQ336:' + ymd(1) + ':YCL', menuPayload);
    } });
    await wait(5600);
    const card = d.getElementById('ca-nextflight-card');
    R.ok(card, 'next-flight card appears under the greeting');
    R.ok(card && card.textContent.indexOf('SQ 336') >= 0 && card.textContent.indexOf('CDG') >= 0, 'card shows flight + route');
    R.ok(card && card.textContent.indexOf('tomorrow') >= 0, 'relative label reads tomorrow');
    R.ok(card && /Menus saved/.test(card.textContent), 'saved badge present');
    R.ok(await waitChatIdle(w), 'chat settles after the greeting');
    d.getElementById('ca-nextflight-tap').click();
    await wait(250);
    R.ok(!d.getElementById('menu-backdrop').classList.contains('hidden'), 'tap with saved menus opens the viewer directly');
    R.ok(!d.querySelector('[id^="fv-flight-"]'), 'no flight-verification card in the flow');
    R.ok(d.getElementById('menu-cabin-label') && d.getElementById('menu-cabin-label').textContent === 'Business', 'viewer lands on the first cabin, switchable');
  }
  {
    // not saved + online -> fetch EVERY cabin, then open the viewer
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
    } });
    await wait(5600);
    R.ok(await waitChatIdle(w), 'chat settles after the greeting');
    w.fetch = async (u, opts) => {
      const body = JSON.parse((opts && opts.body) || '{}');
      if (body.endpoint === 'getcabin') return new Response(JSON.stringify({ statusCode: 200, aircraftType: '787-10', cabinClasses: ['JCL', 'YCL'] }), { status: 200 });
      if (body.endpoint === 'menu') return new Response(menuPayloadData, { status: 200 });
      return new Response('{}', { status: 200 });
    };
    d.getElementById('ca-nextflight-tap').click();
    await wait(700);
    R.ok(!!w.localStorage.getItem('SQ336:' + ymd(1) + ':CABINS'), 'tap caches the cabin schedule');
    R.ok(!!w.localStorage.getItem('SQ336:' + ymd(1) + ':JCL') && !!w.localStorage.getItem('SQ336:' + ymd(1) + ':YCL'), 'tap fetches EVERY cabin menu, not just the guess');
    R.ok(!d.getElementById('menu-backdrop').classList.contains('hidden'), 'viewer opens once every cabin is saved');
  }
  {
    // not saved + offline -> honest notice, no viewer
    const { w, d } = await boot(APP, { seed: (x) => {
      Object.defineProperty(x.navigator, 'onLine', { value: false, configurable: true });
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
    } });
    await wait(5600);
    R.ok(await waitChatIdle(w), 'chat settles after the greeting');
    d.getElementById('ca-nextflight-tap').click();
    await waitChatIdle(w);
    R.ok(d.getElementById('chat-container').textContent.indexOf('offline — connect once') >= 0, 'offline tap explains instead of failing silently');
    R.ok(d.getElementById('menu-backdrop').classList.contains('hidden'), 'no viewer without saved menus offline');
  }

  {
    // saved-schedule cache → badge + no nudge for that flight
    const { d } = await boot(APP, { seed: (w) => {
      seedProfile(w);
      w.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
      w.localStorage.setItem('SQ336:' + ymd(1) + ':CABINS', JSON.stringify({ timestamp: Date.now(), data: { statusCode: 200, cabinClasses: ['JCL'] } }));
    } });
    await wait(5600);
    const card = d.getElementById('ca-nextflight-card');
    R.ok(card && /Menus saved/.test(card.textContent), 'saved cabin schedule shows the menus-saved badge');
    R.ok(!d.getElementById('ca-menunudge-card'), 'no nudge when the menus are already saved');
  }

  // --- the nudge ---
  {
    // single flight tomorrow, online, nothing saved
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
    } });
    await wait(5600);
    const nudge = d.getElementById('ca-menunudge-card');
    R.ok(nudge, 'flight inside the 48h window without saved menus → nudge appears');
    R.ok(nudge && nudge.textContent.indexOf('departs tomorrow') >= 0, 'single-flight copy names flight + timing');
    R.ok(nudge && nudge.textContent.indexOf('Open menus') >= 0, 'single-flight nudge offers Open menus');
    R.ok(nudge && !!nudge.querySelector('[data-lucide="plane"]'), 'nudge carries the plane icon');
    R.ok(nudge && nudge.innerHTML.indexOf('wifi-off') < 0, 'no wifi-off icon anymore');
    R.ok(nudge && nudge.innerHTML.indexOf('departs tomorrow') < nudge.innerHTML.indexOf('ca-menunudge-go'), 'text sits above the button');
    R.ok(nudge && nudge.querySelector('#ca-menunudge-go').parentElement.className.indexOf('justify-center') >= 0, 'button is centered below the text');
    // dismiss → animated away + remembered per flight
    R.ok(await waitChatIdle(w), 'chat settles before dismissing');
    d.getElementById('ca-menunudge-x').click();
    await wait(60);
    const mid = d.getElementById('ca-menunudge-card');
    R.ok(mid && mid.style.opacity === '0', 'dismissal animates the card away');
    await wait(420);
    R.ok(!d.getElementById('ca-menunudge-card'), 'card gone after the animation');
    const dis = JSON.parse(w.localStorage.getItem('crewAssist.nudgeDismissed') || '{}');
    R.ok(dis['336|' + ymd(1)] === 1, 'dismissal is remembered per flight + date');
  }
  {
    // three turnaround days → consolidated copy + save-all sweep
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '301', dep: 'SIN', arr: 'ICN', ymd: ymd(0), std: '0100' },
        { fn: '302', dep: 'SIN', arr: 'ICN', ymd: ymd(1), std: '0100' },
        { fn: '303', dep: 'SIN', arr: 'ICN', ymd: ymd(2), std: '0100' }
      ])));
    } });
    await wait(5600);
    const nudge = d.getElementById('ca-menunudge-card');
    R.ok(nudge && nudge.textContent.indexOf('3 flights in the next 2 days') >= 0, 'three flights in the window → consolidated copy');
    R.ok(nudge && nudge.textContent.indexOf('Save all menus') >= 0, 'multi-flight nudge offers Save all menus');
    R.ok(nudge && nudge.querySelectorAll('.ca-menunudge-row').length === 3, 'one row per flight');
    // the sweep, against a stubbed live API
    w.fetch = async (u, opts) => {
      const body = JSON.parse((opts && opts.body) || '{}');
      if (body.endpoint === 'getcabin') return new Response(JSON.stringify({ statusCode: 200, cabinClasses: ['FCL', 'JCL'] }), { status: 200 });
      if (body.endpoint === 'menu') return new Response(JSON.stringify({ statusCode: 200, legs: [] }), { status: 200 });
      return new Response('{}', { status: 200 });
    };
    R.ok(await waitChatIdle(w), 'chat settles before the sweep');
    d.getElementById('ca-menunudge-go').click();
    await wait(600);
    R.ok(!!w.localStorage.getItem('SQ301:' + ymd(0) + ':CABINS'), 'sweep caches the cabin schedule');
    R.ok(!!w.localStorage.getItem('SQ301:' + ymd(0) + ':JCL'), 'sweep caches each cabin menu');
    const recent = JSON.parse(w.localStorage.getItem('crewAssist.recentFlights') || '[]');
    R.ok(recent.some((r) => r.flight === '301'), 'sweep registers the flight as recent (keeps the prune aligned)');
    await wait(500);
    const launch = d.getElementById('ca-menulaunch-card');
    R.ok(launch, 'a fully-saved sweep turns the reminder into a launcher');
    R.ok(launch && launch.textContent.indexOf('Menus saved for 3 flights') >= 0, 'launcher copy counts the saved flights');
    const goBtnAfter = launch && launch.querySelector('#ca-menunudge-go');
    R.ok(goBtnAfter && goBtnAfter.style.pointerEvents === 'none', 'launcher button is inert');
    launch.querySelector('.ca-menunudge-row').click();
    await wait(300);
    R.ok(!d.getElementById('menu-backdrop').classList.contains('hidden'), 'tapping a saved row opens that flight menus directly');
    const card = d.getElementById('ca-nextflight-card');
    R.ok(card && /Menus saved/.test(card.textContent), 'next-flight card now carries the saved badge');
  }
  {
    // offline boot → no nudge; coming online brings it back
    const { w, d } = await boot(APP, { seed: (x) => {
      Object.defineProperty(x.navigator, 'onLine', { value: false, configurable: true });
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
    } });
    await wait(5600);
    R.ok(d.getElementById('ca-nextflight-card'), 'offline still shows the next-flight card (it is local)');
    R.ok(!d.getElementById('ca-menunudge-card'), 'offline → no nudge (nothing to fetch)');
    Object.defineProperty(w.navigator, 'onLine', { value: true, configurable: true });
    w.dispatchEvent(new w.Event('online'));
    await wait(250);
    R.ok(d.getElementById('ca-menunudge-card'), 'back online → the nudge appears');
  }
  {
    // expired roster → dormant (all flights past)
    const { d } = await boot(APP, { seed: (w) => {
      seedProfile(w);
      w.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(-3), std: '0017' }])));
    } });
    await wait(5600);
    R.ok(!d.getElementById('ca-nextflight-card'), 'expired roster → no card');
    R.ok(!d.getElementById('ca-menunudge-card'), 'expired roster → no nudge');
  }

  process.exit(R.done() ? 1 : 0);
})();
