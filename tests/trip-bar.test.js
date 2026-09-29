// Trip bars: sector boxes turn green when their sector/station is fetched,
// updated in place (colour transition survives), via the real Fetch-all flow.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
(async () => {
  // IFA
  {
    const { w, d } = await boot(APP);
    const today = w.todayLocalYMD();
    const [Y, M, D] = today.split('-').map(Number);
    const leg = () => ({ depAirport: 'SIN', arrAirport: 'JNB',
        depLocal: new Date(Y, M - 1, D, 9, 0), arrLocal: new Date(Y, M - 1, D, 15, 30),
        depUtc: new Date(Date.UTC(Y, M - 1, D, 1, 0)), arrUtc: new Date(Date.UTC(Y, M - 1, D, 7, 30)), hours: 6.5 });
    w.fetchSectorSchedule = async () => ({ ok: true, legs: [leg()] }); // global: override is seen by the card closures
    w.renderCalculatorCard('ifa');
    await wait(100);
    const route = d.querySelector('[id$="-ifa-trip-route"]');
    const node1 = route.children[2];
    R.eq(node1.textContent, '\u00b7\u00b7\u00b7', 'IFA: unfetched sector starts as dots');
    R.ok(!node1.className.includes('emerald'), 'IFA: dots box is not green');

    // the card opens with two sectors: both flight numbers arm Fetch all
    for (const suf of ['-ifa-fn1', '-ifa-fn2']) {
        const el = d.querySelector('[id$="' + suf + '"]');
        el.value = suf === '-ifa-fn1' ? '406' : '407';
        el.dispatchEvent(new w.Event('input', { bubbles: true }));
    }
    const dt = d.querySelector('[id$="-ifa-d1"]');
    dt.value = today;
    dt.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    const allBtn = d.querySelector('[id$="-ifa-fetch-all"]');
    R.ok(!allBtn.disabled, 'IFA: Fetch all armed once flight numbers are in');
    allBtn.click();
    await wait(400);
    const node1b = route.children[2];
    R.ok(node1b === node1, 'IFA: node updated in place (colour transition survives)');
    R.eq(node1b.textContent, 'JNB', 'IFA: fetched arrival shown');
    R.ok(node1b.className.includes('emerald'), 'IFA: fetched sector box is green');
    R.ok(route.children[4].className.includes('emerald'), 'IFA: second fetched sector box is green too');
    R.ok(d.querySelector('[id$="-ifa-trip-progress"]').textContent.indexOf('2 of 2 fetched') !== -1, 'IFA: progress counts the fetches');
  }

  // LMA
  {
    const { w, d } = await boot(APP);
    const today = w.todayLocalYMD();
    const [Y, M, D] = today.split('-').map(Number);
    const leg = () => ({ depAirport: 'SIN', arrAirport: 'JNB',
        depLocal: new Date(Y, M - 1, D, 9, 0), arrLocal: new Date(Y, M - 1, D, 15, 30),
        depUtc: new Date(Date.UTC(Y, M - 1, D, 1, 0)), arrUtc: new Date(Date.UTC(Y, M - 1, D, 7, 30)), hours: 6.5 });
    w.fetchSectorSchedule = async () => ({ ok: true, legs: [leg()] });
    w.renderCalculatorCard('lma');
    await wait(100);
    const route = d.querySelector('[id$="-lma-trip-route"]');
    const node1 = route.children[2];
    R.eq(node1.textContent, '\u00b7\u00b7\u00b7', 'LMA: unfetched station starts as dots');

    const set = (suf, v) => { const el = d.querySelector('[id$="' + suf + '"]'); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
    set('-lma-afn1', 'SQ406');
    set('-lma-dfn1', 'SQ407');
    set('-lma-a1', today);
    set('-lma-d1', today);
    await wait(50);
    d.querySelector('[id$="-lma-fetch-all"]').click();
    await wait(500);
    const node1b = route.children[2];
    R.ok(node1b === node1, 'LMA: node updated in place');
    R.eq(node1b.textContent, 'JNB', 'LMA: fetched station shown');
    R.ok(node1b.className.includes('emerald'), 'LMA: fetched station box is green');
  }

  process.exit(R.done() ? 1 : 0);
})();
