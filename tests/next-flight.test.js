// Next-flight awareness (v1.28.0): the roster import remembers upcoming
// flights (positioning duties excluded), the greeting shows a tappable
// next-flight card, and an amber nudge offers to save menus for flights
// departing inside the 48h window before you lose signal.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');

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
    // showed in the card at 17:58. v1.40.1: the clock is PINNED (the
    // date-stability rule) — near SGT midnight a real-clock "-60 min" seed
    // wraps past midnight and reads as a future departure, killing the
    // in-air case (it failed at 00:34 local on 2026-10-08).
    const PIN = '2026-10-07T14:32:00+08:00';
    const base = new Date(PIN).getTime();
    const hm = (offMin) => {
      const t = new Date(base + offMin * 60000);
      return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    };
    const ymdB = (off) => { const t = new Date(base + off * DAY); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
    // a leg that landed YESTERDAY morning — fixed walls, immune to the
    // run hour (a "6.5h ago" seed wraps past midnight and turns future)
    const landed = { fn: '118', dep: 'KUL', arr: 'SIN', ymd: ymdB(-1), std: '08:25', sta: '09:35', staYmd: ymdB(-1) };
    const inAirSta = hm(120); // pinned once — a minute roll between seed and assert must not rewrite it
    const inAir = { fn: '105', dep: 'KUL', arr: 'SIN', ymd: ymdB(0), std: hm(-60), sta: inAirSta, staYmd: ymdB(0) };
    // (a) part two, mid-air: the landed leg is gone, the airborne one leads
    const { d } = await boot(APP, { now: PIN, seed: (x) => {
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
    const { d: d2 } = await boot(APP, { now: PIN, seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([{ fn: '321', dep: 'SIN', arr: 'HKT', ymd: ymdB(0), std: hm(-720) }])));
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
    // ---- round 13 (owner order): the KUL exception — a KUL-bound outbound
    // wakes later (alarm STD−3h30m, report line STD−1h30m); every other
    // station keeps the NRT-pinned −4h/−2h chain above ----
    const { d } = await boot(APP, { now: '2026-10-11T20:00:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', staYmd: '2026-10-12' }
      ])));
    } });
    let k1 = null; const tK = Date.now();
    while (Date.now() - tK < 9000 && !(k1 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const pk = k1 ? k1.textContent : '';
    R.ok(k1 && pk.indexOf('Suggested alarm 0455H') >= 0, 'KUL outbound: alarm = STD − 3h30m (0825 − 0330)');
    R.ok(pk.indexOf('Reporting 0655H') >= 0 && pk.indexOf('STD 0825H') >= 0, 'KUL outbound: report line = STD − 1h30m');
    R.ok(pk.indexOf('SQ 106') >= 0 && pk.indexOf('KUL') >= 0, 'KUL outbound: the card still reads flight + station');
  }
  {
    // the window follows the alarm it shows: 15h45m before a KUL STD the
    // section still waits (15.75h > the KUL 15.5h opening) — an NRT card at
    // the same offset would already show, because its window opens at 16h
    const { d } = await boot(APP, { now: '2026-10-11T16:40:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', staYmd: '2026-10-12' }
      ])));
    } });
    let k2 = null; const tK2 = Date.now();
    while (Date.now() - tK2 < 9000 && !(k2 = d.getElementById('ca-nextflight-card'))) await wait(50);
    const pk2 = k2 ? k2.textContent : '';
    R.ok(k2 && pk2.indexOf('Suggested alarm') === -1 && pk2.indexOf('Departs 0825H') >= 0, 'KUL window: hidden at 15h45m out — the window follows the shorter alarm, not the flat 16h');
  }
  {
    // ---- round 17 (owner order): a rung alarm retires — the window closes
    // at the alarm itself, not at departure. Alarm 0545H, so at 0544H it is
    // still suggesting and at 0546H it is gone (the reporting sub-line rides
    // the block it belongs to) ----
    const { d } = await boot(APP, { now: '2026-10-06T05:44:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' },
        { fn: '807', dep: 'NRT', arr: 'SIN', ymd: '2026-10-08', std: '20:30', sta: '06:29', staYmd: '2026-10-09' }
      ])));
    } });
    let r17a = null; const t17a = Date.now();
    while (Date.now() - t17a < 9000 && !(r17a = d.getElementById('ca-nextflight-card'))) await wait(50);
    const p17a = r17a ? r17a.textContent : '';
    R.ok(r17a && p17a.indexOf('Suggested alarm 0545H') >= 0, 'round 17: one minute before it rings the suggestion is still there');
  }
  {
    const { w, d } = await boot(APP, { now: '2026-10-06T05:40:00+08:00', seed: (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore([
        { fn: '802', dep: 'SIN', arr: 'NRT', ymd: '2026-10-06', std: '09:45', sta: '18:27', staYmd: '2026-10-06' }
      ])));
    } });
    let r17b = null; const t17b = Date.now();
    while (Date.now() - t17b < 9000 && !(r17b = d.getElementById('ca-nextflight-card'))) await wait(50);
    const p17b0 = r17b ? r17b.textContent : '';
    R.ok(r17b && p17b0.indexOf('Suggested alarm 0545H') >= 0, 'round 17: at 05:40 the card suggests the 0545H alarm');
    R.ok(r17b && Number(r17b.getAttribute('data-alarm-until')) === Date.parse('2026-10-06T05:45:00+08:00'), 'round 17: the card stamps its alarm window edge (until = the alarm instant)');
    // freeze the clock past the alarm and run the minute sweep by hand —
    // the block must leave the card without any other event re-rendering
    w.eval('(function(f){ const RD = Date; class F extends RD { constructor(...a){ super(...(a.length ? a : [f])); } static now(){ return f; } } window.Date = F; })(' + Date.parse('2026-10-06T05:46:00+08:00') + ')');
    w.eval('nfAlarmSweep()');
    await wait(400);
    const r17b2 = d.getElementById('ca-nextflight-card');
    const p17b2 = r17b2 ? r17b2.textContent : '';
    R.ok(r17b2 && p17b2.indexOf('Suggested alarm') === -1 && p17b2.indexOf('Departs 0945H') >= 0 && p17b2.indexOf('SQ 802') >= 0, 'round 17: the sweep retires a rung alarm at once — the flight card itself stays');
  }
  {
    // ---- round 17 (owner order): a multi-sector turnaround suggests the
    // alarm ONCE — the day's first departure only. Two turnarounds on
    // 2026-10-12: viewing mid-day (after the first landed) the card moves to
    // the evening sector, whose alarm window is open — but the crew is
    // already awake, so no suggestion; the same day viewed at 03:00 still
    // suggests for the morning's first departure ----
    const legs17 = [
      { fn: '106', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '08:25', sta: '09:35', staYmd: '2026-10-12' },
      { fn: '105', dep: 'KUL', arr: 'SIN', ymd: '2026-10-12', std: '10:25', sta: '11:45', staYmd: '2026-10-12' },
      { fn: '836', dep: 'SIN', arr: 'KUL', ymd: '2026-10-12', std: '23:00', sta: '00:10', staYmd: '2026-10-13' }
    ];
    const seed17 = (x) => {
      seedProfile(x);
      x.localStorage.setItem('crewAssist.upcoming', JSON.stringify(mkStore(legs17)));
      x.localStorage.setItem('crewAssist.allFlights', JSON.stringify(mkStore(legs17)));
    };
    {
      const { d } = await boot(APP, { now: '2026-10-12T12:00:00+08:00', seed: seed17 });
      let r17c = null; const t17c = Date.now();
      while (Date.now() - t17c < 9000 && !(r17c = d.getElementById('ca-nextflight-card'))) await wait(50);
      const p17c = r17c ? r17c.textContent : '';
      R.ok(r17c && p17c.indexOf('SQ 836') >= 0 && p17c.indexOf('Departs 2300H') >= 0, 'round 17: mid-day the card has moved to the evening sector');
      R.ok(r17c && p17c.indexOf('Suggested alarm') === -1, 'round 17: the later same-day sector never suggests an alarm — the crew is already awake');
    }
    {
      const { d } = await boot(APP, { now: '2026-10-12T03:00:00+08:00', seed: seed17 });
      let r17d = null; const t17d = Date.now();
      while (Date.now() - t17d < 9000 && !(r17d = d.getElementById('ca-nextflight-card'))) await wait(50);
      const p17d = r17d ? r17d.textContent : '';
      R.ok(r17d && p17d.indexOf('SQ 106') >= 0 && p17d.indexOf('Suggested alarm 0455H') >= 0, 'round 17: the day\u2019s first departure still gets its wake-up suggestion');
    }
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
  // ---- v1.43.0 hotfix round 12: the curated station list + full TZ coverage ----
  {
    // the list and the zone map are top-level consts — scoped to the eval'd
    // app script, so the STRUCTURE is verified node-side from the source;
    // the FUNCTIONS (which close over the consts) are verified page-side
    const src = fs.readFileSync(APP, 'utf8');
    const listSrc = src.match(/const airports = \[[\s\S]*?\n\];/)[0];
    // round 16: the map lives at column 0 in the owner's section format —
    // the closer indent is no longer pinned (the old 8-space regex would
    // run past the map and over-capture)
    const tzSrc = src.match(/const AIRPORT_TZ = \{[\s\S]*?\n\s*\};/)[0];
    const list = eval(listSrc + '; airports;');
    const tz = eval('(' + tzSrc.replace('const AIRPORT_TZ =', '').replace(/;\s*$/, '') + ')');
    R.eq(list.length, 139, 'the curated SQ + Scoot network list carries 139 stations (incl. KNO + PNH)');
    const noTz = list.filter((a) => !tz[a.code]).map((a) => a.code);
    R.eq(noTz.join(','), '', 'every station on the list has a timezone — full AIRPORT_TZ coverage');
    const orphans = Object.keys(tz).filter((k) => !list.some((a) => a.code === k));
    R.eq(orphans.join(','), '', 'no orphan AIRPORT_TZ entries — the map matches the list exactly');
    const codes = list.map((a) => a.code);
    R.ok(['KNO', 'KTI', 'PNH', 'WSI'].every((c) => codes.indexOf(c) !== -1), 'KNO (owner correction), KTI (Techo), PNH (Pochentong history) and WSI are all aboard');
    R.eq(tz.KTI, 'Asia/Phnom_Penh', 'Techo keeps Phnom Penh clocks');
    R.eq(tz.LGW, 'Europe/London', 'London Gatwick converts (the old map only knew Heathrow)');
    R.eq(tz.DRW, 'Australia/Darwin', 'Darwin converts (+9:30)');
    R.eq(tz.UPG, 'Asia/Makassar', 'Makassar is WITA, not Jakarta time');
    // the live functions (they close over the eval-scoped consts)
    const { w } = await boot(APP);
    R.eq(w.eval("getRegionForAirport('BWN')"), 'Southeast Asia', 'Brunei joins the Southeast Asia rate family (owner order)');
    R.eq(w.eval("getRegionForAirport('VTE')"), 'Southeast Asia', 'Laos joins the Southeast Asia rate family (owner order)');
    R.eq(w.eval("airportZone('KTI')"), 'Asia/Phnom_Penh', 'airportZone resolves Techo');
    R.eq(w.eval("airportZone('LGW')"), 'Europe/London', 'airportZone resolves Gatwick');

    // ---- round 14 (owner recode, adopted): the regrouped map, the load-time
    // validator, and the single-digit-hour hardening ----
    R.eq(tz.SUB, 'Asia/Jakarta', 'round 14: Surabaya keeps WIB — all of Java runs +7 (the recode had dropped SUB)');
    R.ok(['BKI', 'KCH', 'MYY', 'SBW'].every((k) => tz[k] === 'Asia/Kuching'), 'round 14: East Malaysia carries its own geographically true zone (same UTC+8 clock as Kuala Lumpur)');
    R.eq(w.eval("typeof validateAirportTimezones"), 'function', 'round 14: the load-time zone validator exists page-side');
    R.ok(w.eval("JSON.stringify((function(){ var r = validateAirportTimezones(); return r.valid === true && r.missing.length === 0 && r.orphaned.length === 0; })())") === 'true', 'round 14: the validator passes clean — full coverage, zero orphans, no throw');
    R.eq(w.eval("typeof TZ_VALIDATION"), 'undefined', 'round 14: the TZ_VALIDATION const stays eval-scoped (never a page global)');
    R.ok(w.eval("JSON.stringify((function(){ var a = zonedWallToUtcMs('2027-01-15', '8:25', 'Asia/Makassar'); var b = zonedWallToUtcMs('2027-01-15', '08:25', 'Asia/Makassar'); return isFinite(a) && a === b; })())") === 'true', 'round 14: a single-digit hour pads before Date.parse (the guard always admitted it, the parser never did)');
    R.eq(w.eval("landingSgtPhrase('BKI', '2026-10-20', '10:00')"), '', 'round 14: Kuching shares the SGT clock — the landing phrase stays empty (zone renamed, clock unchanged)');
    R.eq(w.eval("landingSgtPhrase('KUL', '2026-10-20', '8:25')"), '', 'round 16: the same-clock comparison pads single-digit hours — an unpadded KUL time never shows a spurious conversion');
    R.eq(w.eval("landingSgtPhrase('KTI', '2026-10-20', '8:25')"), '09:25 SGT', 'round 16: an unpadded converting station still lands right');

    R.eq(w.eval("landingSgtPhrase('KTI', '2026-10-20', '10:00')"), '11:00 SGT', 'a Techo landing converts to SGT (Phnom Penh is +7)');
    R.eq(w.eval("landingSgtPhrase('KNO', '2026-10-20', '10:00')"), '11:00 SGT', 'a Medan landing converts to SGT (WIB +7)');
  }
  process.exit(R.done() ? 1 : 0);
})();
