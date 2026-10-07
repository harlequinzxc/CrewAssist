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
// at the same x (shapes taken from the real reference rosters).
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
    // v1.28.4: the chat fast lane — greeting + card land in seconds, not the
    // classic ~4.5s ceremony (dots 150-250ms, gap 250ms, animation unchanged)
    const { d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(1), std: '0017' }])));
    } });
    const t0 = Date.now();
    let cardAt = -1;
    while (Date.now() - t0 < 8000) {
      if (d.getElementById('ca-nextflight-card')) { cardAt = Date.now(); break; }
      await wait(50);
    }
    R.ok(cardAt > 0 && (cardAt - t0) < 3200, 'next-flight card arrives on the fast lane (<3.2s; the classic pace took ~4.5s)');
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

  {
    // v1.31.1 (owner report): SQ106 SIN-KUL and SQ105 KUL-SIN on the same day
    // are ONE duty — the card lists both, each with its own badge and tap,
    // and flights on later days wait their turn.
    const { d } = await boot(APP, { seed: (w) => {
      seedProfile(w);
      w.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: ymd(1), std: '0900' },
        { fn: '105', dep: 'KUL', arr: 'SIN', ymd: ymd(1), std: '1830' },
        { fn: '336', dep: 'SIN', arr: 'CDG', ymd: ymd(2), std: '0017' }
      ])));
    } });
    await wait(5600);
    const card = d.getElementById('ca-nextflight-card');
    R.ok(card, 'the card renders for the out-and-back day');
    R.ok(card && card.textContent.indexOf('SQ 106') >= 0 && card.textContent.indexOf('KUL') >= 0, 'v1.38.0 hotfix: part one presents the outbound — SQ 106 to KUL');
    R.ok(card && card.textContent.indexOf('SQ 105') === -1, 'the homebound leg waits its turn — part two begins once SQ 106 lands');
    R.ok(card && card.textContent.indexOf('SQ 336') === -1, 'a later duty waits its turn');
    const rows = card ? card.querySelectorAll('.ca-nextflight-tap') : [];
    R.eq(rows.length, 1, 'one tap target — the presented part');
    R.ok(rows[0] && rows[0].id === 'ca-nextflight-tap', 'the tap keeps the original id');
    R.ok(card && !/Menus saved/.test(card.textContent), 'no badge until a flight is actually saved');
  }

  
  // --- v1.33.1: a landed flight leaves the card; the air shows its landing ---
  {
    // The owner's exact case: a KUL turnaround that landed at 11:45 still
    // showed in the card at 17:58. Times are seeded relative to the real
    // clock so the case holds on any run date.
    const hm = (offMin) => {
      const t = new Date(Date.now() + offMin * 60000);
      return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    };
    // a leg that landed YESTERDAY morning — fixed walls, immune to the
    // run hour (a "6.5h ago" seed wraps past midnight and turns future)
    const landed = { fn: '118', dep: 'KUL', arr: 'SIN', ymd: ymd(-1), std: '08:25', sta: '09:35', staYmd: ymd(-1) };
    const inAirSta = hm(120); // pinned once — a minute roll between seed and assert must not rewrite it
    const inAir = { fn: '105', dep: 'KUL', arr: 'SIN', ymd: ymd(0), std: hm(-60), sta: inAirSta, staYmd: ymd(0) };
    // (a) part two, mid-air: the landed leg is gone, the airborne one leads
    const { d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([landed, inAir])));
    } });
    let card = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && !(card = d.getElementById('ca-nextflight-card'))) await wait(50);
    R.ok(!!card, 'the airborne leg renders the card');
    const txt = card ? card.textContent : '';
    R.ok(txt.indexOf('SQ 118') === -1, 'a flight that landed hours ago is gone from the card');
    R.ok(txt.indexOf('SQ 105') >= 0 && txt.indexOf('KUL') >= 0, 'part two names the flight and the station the crew is at');
    R.ok(txt.indexOf('In the air') >= 0 && txt.indexOf('lands in') >= 0, 'v1.38.0 hotfix: a leg in the air shows a live landing countdown');
    R.ok(txt.indexOf('Lands SIN ' + String(inAirSta).replace(':', '') + 'H SGT') >= 0, 'the homebound landing reads in SGT, 24-hour H format');
    R.ok(!d.getElementById('ca-layover-tz-card'), 'no layover time-zone card while flying home');
    // (b) a statless leg (no arrival printed) is kept for the day
    const { d: d2 } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '321', dep: 'SIN', arr: 'HKT', ymd: ymd(0), std: hm(-720) }])));
    } });
    let card2 = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 8000 && !(card2 = d2.getElementById('ca-nextflight-card'))) await wait(50);
    const txt2 = card2 ? card2.textContent : '';
    R.ok(txt2.indexOf('SQ 321') >= 0, 'a flight with no arrival on record is kept for the day');
    R.ok(!/Lands /.test(txt2), 'no landing line is invented without a printed arrival');
  }
  {
    // everything today has landed → tomorrow leads, and the store remembers
    // arrival times for the future (re-attaching a roster records STA + date).
    const hm = (offMin) => {
      const t = new Date(Date.now() + offMin * 60000);
      return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    };
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '118', dep: 'KUL', arr: 'SIN', ymd: ymd(-1), std: '08:25', sta: '09:35', staYmd: ymd(-1) }
      ])));
    } });
    let card = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && !(card = d.getElementById('ca-nextflight-card'))) await wait(50);
    R.ok(!card, 'a day whose every flight has landed renders no card');
    w.eval('upcomingRemember(' + JSON.stringify({ flights: [{ fn: '106', dep: 'SIN', arr: 'KUL', ymd: ymd(1), std: '09:45', sta: '11:45', stdHm: '09:45', staHm: '11:45', staRowYmd: null, pos: false }] }) + ')');
    const store = JSON.parse(w.localStorage.getItem('crewAssist.upcoming'));
    const key = ymd(1).slice(0, 7);
    R.ok(store[key] && store[key].some((f) => f.sta === '11:45' && f.staYmd === ''), 'a re-attach records the arrival time and its row date');
  }
  {
    // the sweep: a flight that lands while the app is open disappears the
    // moment the screen comes back (visibilitychange) — no reload needed.
    // The card is seeded on a flight still ~2 minutes out, then the store is
    // aged to "landed an hour ago" and the app woken — deterministic, no
    // wall-clock race. v1.39.0 hotfix 9: both legs are built from true
    // moments (ymd = departure date, staYmd = arrival date) so an
    // hh:mm-based seed can never straddle midnight and trip the overnight
    // rule — the suite must pass at 2am, not just in the afternoon.
    const hhmm = (t) => String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    const ymdAt = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const leg = (depT, landT) => ({ fn: '105', dep: 'KUL', arr: 'SIN', ymd: ymdAt(depT), std: hhmm(depT), sta: hhmm(landT), staYmd: ymdAt(landT) });
    const landT = new Date(Date.now() + 2 * 60000);
    // the boot leg must depart TODAY (nfFlightEnded retires any flight whose
    // departure date has passed), so the lookback never reaches past midnight
    const nowD = new Date();
    const depBack = Math.min(60, nowD.getHours() * 60 + nowD.getMinutes());
    const { w, d } = await boot(APP, { seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([leg(new Date(Date.now() - depBack * 60000), landT)])));
    } });
    let card = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && !(card = d.getElementById('ca-nextflight-card'))) await wait(50);
    R.ok(!!card, 'the not-yet-landed flight shows its card');
    w.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
      leg(new Date(Date.now() - 180 * 60000), new Date(Date.now() - 60 * 60000))
    ])));
    d.dispatchEvent(new w.Event('visibilitychange'));
    await wait(300);
    R.ok(!d.getElementById('ca-nextflight-card'), 'the sweep retires the card the moment the flight lands');
    const store = JSON.parse(w.localStorage.getItem('crewAssist.upcoming'));
    R.ok(!JSON.stringify(store).match(/"105"/), 'the landed flight is pruned from storage too');
  }

  {
    // ---- v1.38.0 hotfix (owner spec): part one — alarm + flight + details ----
    const { d } = await boot(APP, { now: '2026-10-05T22:00:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' },
        { fn: '807', dep: 'NRT', arr: 'SIN', ymd: '2026-10-08', std: '20:30', sta: '06:29', staYmd: '2026-10-09' }
      ])));
    } });
    let c1 = null; const tA = Date.now();
    while (Date.now() - tA < 9000 && !(c1 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const p1 = c1 ? c1.textContent : '';
    R.ok(c1 && p1.indexOf('Suggested alarm 0545H') >= 0, 'part one: suggested alarm = STD − 4h, 24-hour H format');
    R.ok(p1.indexOf('Reporting 0745H') >= 0 && p1.indexOf('STD 0945H') >= 0, 'part one: reporting 2h before STD, no transport line');
    R.ok(p1.indexOf('SQ 802') >= 0 && p1.indexOf('NRT') >= 0, 'part one: flight number + station IATA');
    R.ok(p1.indexOf('Departs 0945H \u00b7 in 11h 45m') >= 0, 'part one: departs clock + live countdown');
    R.ok(p1.indexOf('Lands NRT 1827H local \u00b7 1727H SGT') >= 0, 'part one: landing in station local AND SGT');
    R.ok(p1.indexOf('SQ 807') === -1, 'part one never leaks the homebound leg');
    R.ok(c1 && !!c1.querySelector('#ca-nf-save'), 'the save-menu button rides with the flight');
    // hotfix 12 (owner order): every detail line stays on ONE row — narrow
    // screens used to flow each line onto two. The date, the in-air/departs
    // line, the lands lines and the alarm's two lines all pin nowrap (the
    // wrapper span stays wrappable — nowrap there would fuse every line into
    // one; only the LEAF lines carry it).
    {
        const textLines = c1 ? Array.from(c1.querySelectorAll('span.block')).filter((sp) => !sp.querySelector('span') && (sp.textContent || '').match(/Departs|Lands|Suggested alarm|Reporting/)) : [];
        R.ok(textLines.length >= 3 && textLines.every((sp) => sp.className.indexOf('whitespace-nowrap') >= 0), 'hotfix 12: every flight-card text line carries nowrap — one row each, no flowing down');
    }
    R.ok(!d.getElementById('ca-layover-tz-card'), 'no layover card while in SG');
  }
  {
    // outside the alarm window (12h before alarm) the section simply waits
    const { d } = await boot(APP, { now: '2026-10-05T08:00:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' }
      ])));
    } });
    let c2 = null; const tB = Date.now();
    while (Date.now() - tB < 9000 && !(c2 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const p1b = c2 ? c2.textContent : '';
    R.ok(c2 && p1b.indexOf('Suggested alarm') === -1, 'the alarm section stays hidden before its 12h window');
    R.ok(p1b.indexOf('SQ 802') >= 0 && p1b.indexOf('Departs 0945H') >= 0, 'the flight and its details still show');
  }
  {
    // ---- part two: at the station + the layover time-zone card ----
    const { d } = await boot(APP, { now: '2026-10-07T14:32:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '807', dep: 'NRT', arr: 'SIN', ymd: '2026-10-08', std: '20:30', sta: '06:29', staYmd: '2026-10-09' }
      ])));
    } });
    let c3 = null; const tC = Date.now();
    while (Date.now() - tC < 9000 && !(c3 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const p2 = c3 ? c3.textContent : '';
    R.ok(c3 && p2.indexOf('Suggested alarm') === -1, 'part two carries no alarm — reporting is a SIN rule');
    R.ok(p2.indexOf('SQ 807') >= 0 && p2.indexOf('NRT') >= 0, 'part two: flight number + the station the crew is at');
    R.ok(p2.indexOf('Departs 2030H local') >= 0, 'part two: departure reads in station-local time');
    R.ok(p2.indexOf('Lands SIN 0629H SGT') >= 0, 'part two: the homebound landing reads in SGT');
    const tz = d.getElementById('ca-layover-tz-card');
    R.ok(!!tz, 'the layover time-zone card appears while at the station');
    const tzTxt = tz ? tz.textContent : '';
    R.ok(tzTxt.indexOf('NRT \u2014 1532H') >= 0 && tzTxt.indexOf('1 hour ahead of SG') >= 0, 'the station line: live local time + offset from SG');
    R.ok(tzTxt.indexOf('SG \u2014 1432H') >= 0, 'the SG line: Singapore\u2019s own clock');
    const chat = d.getElementById('chat-container');
    const kids = Array.from(chat.children);
    R.ok(kids.indexOf(tz) > -1 && kids.indexOf(c3) > -1 && kids.indexOf(tz) < kids.indexOf(c3), 'the time-zone card sits after the greetings, before the flight card');
  }
  {
    // ---- hotfix 8 (owner order): a station keeping Singapore time folds
    // the card to ONE line - "PEK - 1432H same as SGT" ----
    const { d } = await boot(APP, { now: '2026-10-07T14:32:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'PEK', arr: 'SIN', ymd: '2026-10-08', std: '20:30', sta: '06:29', staYmd: '2026-10-09' }
      ])));
    } });
    let c5 = null; const tE = Date.now();
    while (Date.now() - tE < 9000 && !(c5 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const tz2 = d.getElementById('ca-layover-tz-card');
    R.ok(!!tz2, 'the layover card still appears at a same-clock station');
    const txt2 = tz2 ? tz2.textContent : '';
    R.ok(txt2.indexOf('PEK \u2014 1432H same as SGT') >= 0, 'PEK (Singapore\u2019s own clock) reads ONE line: PEK \u2014 1432H same as SGT');
    R.ok(txt2.indexOf('SG \u2014') < 0, 'no second SG line when the clocks match');
    R.ok(txt2.indexOf('ahead of SG') < 0 && txt2.indexOf('behind SG') < 0, 'no offset phrase to state when the clocks match');
  }
  {
    // ---- multisector layover: part one presents the whole outbound ----
    const { d } = await boot(APP, { now: '2026-10-05T22:00:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '123', dep: 'SIN', arr: 'KUL', ymd: '2026-10-06', std: '09:45', sta: '11:27', staYmd: '2026-10-06' },
        { fn: '124', dep: 'KUL', arr: 'NRT', ymd: '2026-10-06', std: '13:00', sta: '18:35', staYmd: '2026-10-06' },
        { fn: '125', dep: 'NRT', arr: 'SIN', ymd: '2026-10-09', std: '20:30', sta: '06:29', staYmd: '2026-10-10' }
      ])));
    } });
    let c4 = null; const tD = Date.now();
    while (Date.now() - tD < 9000 && !(c4 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const ms = c4 ? c4.textContent : '';
    R.ok(c4 && ms.indexOf('SQ 123') >= 0 && ms.indexOf('SQ 124') >= 0, 'a multisector outbound names every leg');
    R.ok(ms.indexOf('Departs 0945H') >= 0, 'it departs at the FIRST sector\u2019s time');
    R.ok(ms.indexOf('Lands NRT 1835H local \u00b7 1735H SGT') >= 0, 'it lands at the FINAL station, local + SGT');
    R.ok(c4 && !!c4.querySelector('#ca-nf-save') && c4.textContent.indexOf('Save menus') >= 0, 'the save button goes plural for multiple legs');
  }
  {
    // ---- the save-menu button: save-only, then the badge ----
    const { w, d } = await boot(APP, { now: '2026-10-05T22:00:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' }
      ])));
    } });
    let c5 = null; const tE = Date.now();
    while (Date.now() - tE < 9000 && !(c5 = d.getElementById('ca-nextflight-card'))) await wait(50);
    R.ok(!!c5, 'the card renders before saving');
    w.fetch = async (u, opts) => {
      const body = JSON.parse((opts && opts.body) || '{}');
      if (body.endpoint === 'getcabin') return new Response(JSON.stringify({ statusCode: 200, cabinClasses: ['JCL', 'YCL'] }), { status: 200 });
      if (body.endpoint === 'menu') return new Response(JSON.stringify({ statusCode: 200, legs: [] }), { status: 200 });
      return new Response('{}', { status: 200 });
    };
    const saveBtn = d.getElementById('ca-nf-save');
    R.ok(!!saveBtn, 'the save button exists while menus are unsaved');
    saveBtn.click();
    await wait(700);
    R.ok(!!w.localStorage.getItem('SQ802:2026-10-06:CABINS'), 'save caches the cabin schedule');
    R.ok(!!w.localStorage.getItem('SQ802:2026-10-06:JCL') && !!w.localStorage.getItem('SQ802:2026-10-06:YCL'), 'save fetches every cabin menu');
    const after = d.getElementById('ca-nextflight-card');
    R.ok(after && /Menus saved/.test(after.textContent), 'the card flips to the saved badge');
    R.ok(after && !after.querySelector('#ca-nf-save'), 'no save button once everything is saved');
  }
  process.exit(R.done() ? 1 : 0);
})();
