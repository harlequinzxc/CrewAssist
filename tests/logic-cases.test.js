// The LOGIC.md §6 contract pins: every worked case in the owner's document
// (IFA Tests 1–4, LMA Tests 5a/5b/6 and 6b×2 — nine cases, 24 checks)
// computed through the shipping computeCardResults with the exact figures
// §6 states. §6 is owner-authored (round 25 corrected it to the app's real
// behaviour); these pins make the ship checklist's "re-run the §6 cases"
// step permanent, so a formula regression fails LOUDLY with the case number
// instead of shipping silently. Expectations are pinned from the document,
// not derived — if §6 ever changes by owner order, change them in the same
// round.
// Determinism: every input date is fixed (2026-10-05 / 2026-10-08) and the
// junior tier is flight-date-relative (ifaRankKeyForDate compares
// firstSoloYMD + 24 months against the CARD's date, not the wall clock), so
// the suite needs no clock pin and never breaks on real-time drift.
// The LMA cases include the multi-day report-time boundary round 25 offered
// as a pin (NRT arrive Mon 21:55 → depart Thu: window-start inclusive,
// lunch pays from 13:30, one minute earlier does not) — the smoke pins only
// the single-day dinner form.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
(async () => {
    const { w, d } = await boot(APP);
    await wait(100);
    const swap = (p) => w.eval('localStorage.setItem("crewAssist.profile", ' + JSON.stringify(JSON.stringify(p)) + '); initData();');
    const set = (el, v) => { if (el) { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    const tick = (el) => { if (el && !el.checked) { el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    const newCard = async () => { w.eval('renderCalculatorCard("both")'); await wait(150); const c = d.querySelector('#chat-container [data-calc-card]:last-of-type'); return c.querySelector('input[id$="-ifa-fn1"]').id.slice(0, -'-ifa-fn1'.length); };
    const res = (cid, mode) => JSON.parse(w.eval('JSON.stringify(computeCardResults("' + cid + '", "' + mode + '"))'));
    const money = (cid, mode, field) => w.eval('formatMoney(computeCardResults("' + cid + '", "' + mode + '").' + field + ')');

    // ---- §6 IFA Test 1: junior FS turnaround, SG 04:00 / ST 04:00 → 52 + 52 + 90 = $194.00
    swap({ name: 'T1', gender: 'M', rank: 'FS', firstSoloYMD: '2026-08-01' });
    let cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Turnaround');
    set(d.getElementById(cid + '-ifa-fn1'), '1'); set(d.getElementById(cid + '-ifa-fn2'), '2');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-05');
    set(d.getElementById(cid + '-ifa-t1'), '04:00'); set(d.getElementById(cid + '-ifa-t2'), '04:00');
    R.eq(res(cid, 'both').detail.type, 'Turnaround', 'IFA Test 1: type is Turnaround');
    R.eq(res(cid, 'both').detail.rankRate, 10, 'IFA Test 1: junior FS rides the $10 rate (solo 2026-08-01, flight 2026-10-05 — inside the 24-month window)');
    R.eq(res(cid, 'both').grandTotal, 194, 'IFA Test 1: raw grand total 194 (52 + 52 + 90)');
    R.eq(money(cid, 'both', 'grandTotal'), '$194.00', 'IFA Test 1: formatMoney $194.00');

    // ---- §6 IFA Test 2: FS layover 08:00 / 07:30 → stored 272.0249999999999773 → $272.02
    swap({ name: 'T2', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01' });
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Layover');
    set(d.getElementById(cid + '-ifa-fn1'), '3'); set(d.getElementById(cid + '-ifa-fn2'), '4');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    set(d.getElementById(cid + '-ifa-t1'), '08:00'); set(d.getElementById(cid + '-ifa-t2'), '07:30');
    R.eq(res(cid, 'both').detail.type, 'Layover', 'IFA Test 2: type is Layover');
    R.eq(w.eval('computeCardResults("' + cid + '", "both").grandTotal.toFixed(20)'), '272.02499999999997726263', 'IFA Test 2: the stored double — the sectors print $140.40 + $131.63 but the unrounded sum keeps …97726263 (§5.1 sum-unrounded rule)');
    R.eq(money(cid, 'both', 'grandTotal'), '$272.02', 'IFA Test 2: formatMoney rounds the stored double DOWN to $272.02');

    // ---- §6 IFA Test 3: CS turnaround 11:00 / 10:30 → 610.50 + 582.75 + 90 = $1,283.25
    swap({ name: 'T3', gender: 'M', rank: 'CS' });
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Turnaround');
    set(d.getElementById(cid + '-ifa-fn1'), '5'); set(d.getElementById(cid + '-ifa-fn2'), '6');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-05');
    set(d.getElementById(cid + '-ifa-t1'), '11:00'); set(d.getElementById(cid + '-ifa-t2'), '10:30');
    R.eq(res(cid, 'both').detail.type, 'Turnaround', 'IFA Test 3: type is Turnaround');
    R.eq(res(cid, 'both').grandTotal, 1283.25, 'IFA Test 3: raw grand total 1283.25 (610.50 + 582.75 + 90)');
    R.eq(money(cid, 'both', 'grandTotal'), '$1,283.25', 'IFA Test 3: formatMoney $1,283.25 with comma grouping');

    // ---- §6 IFA Test 4: IFM layover 17:30 / 18:00, Direct US both sectors → 1408.75 + 1449.00 = $2,857.75
    swap({ name: 'T4', gender: 'M', rank: 'IFM' });
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Layover');
    set(d.getElementById(cid + '-ifa-fn1'), '7'); set(d.getElementById(cid + '-ifa-fn2'), '8');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    set(d.getElementById(cid + '-ifa-t1'), '17:30'); set(d.getElementById(cid + '-ifa-t2'), '18:00');
    tick(d.getElementById(cid + '-ifa-us1')); tick(d.getElementById(cid + '-ifa-us2'));
    R.eq(res(cid, 'both').detail.type, 'Layover', 'IFA Test 4: type is Layover');
    R.ok(!!d.getElementById(cid + '-ifa-us1'), 'IFA Test 4: the Direct US toggles exist on the card');
    R.eq(res(cid, 'both').grandTotal, 2857.75, 'IFA Test 4: raw grand total 2857.75 (1408.75 + 1449.00, US multiplier both sectors)');
    R.eq(money(cid, 'both', 'grandTotal'), '$2,857.75', 'IFA Test 4: formatMoney $2,857.75');

    // ---- §6 LMA Tests 5a/5b/6/6b×2 on one Layover card (the engine reads station
    // dates; the flight-type only gates UI prefill). Includes the multi-day
    // report-time boundary (round 25's offered pin): arrive NRT Mon 21:55,
    // depart Thu — report ≥ window START, inclusive.
    swap({ name: 'TL', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01' });
    cid = await newCard();
    const lma = async (iata, ad, at, dd, dt) => {
        set(d.getElementById(cid + '-lma-iata1'), iata);
        set(d.getElementById(cid + '-lma-a1'), ad); set(d.getElementById(cid + '-lma-at1'), at);
        set(d.getElementById(cid + '-lma-d1'), dd); set(d.getElementById(cid + '-lma-dt1'), dt);
        return { raw: Number(w.eval('computeCardResults("' + cid + '", "lma").lmaTotal')), money: money(cid, 'lma', 'lmaTotal') };
    };
    let r = await lma('KUL', '2026-10-05', '10:00', '2026-10-05', '15:30');
    R.eq(r.raw, 55, 'LMA Test 5a: KUL same-day 10:00→15:30 → raw 55');
    R.eq(r.money, '$55.00', 'LMA Test 5a: formatMoney $55.00');
    r = await lma('KUL', '2026-10-05', '12:00', '2026-10-05', '14:30');
    R.eq(r.raw, 0, 'LMA Test 5b: KUL same-day 12:00→14:30 → raw 0 (under the minimum)');
    R.eq(r.money, '$0.00', 'LMA Test 5b: formatMoney $0.00');
    r = await lma('NRT', '2026-10-05', '21:55', '2026-10-08', '12:15');
    R.eq(r.raw, 576, 'LMA Test 6: NRT Mon 21:55 → Thu 12:15, report 12:30 ≥ window start (−60 first, §1.10) → raw 576');
    R.eq(r.money, '$576.00', 'LMA Test 6: formatMoney $576.00');
    r = await lma('NRT', '2026-10-05', '21:55', '2026-10-08', '13:30');
    R.eq(r.raw, 668, 'LMA Test 6b: depart 13:30 → report 12:30 = window start, inclusive → lunch pays, raw 668');
    R.eq(r.money, '$668.00', 'LMA Test 6b: formatMoney $668.00');
    r = await lma('NRT', '2026-10-05', '21:55', '2026-10-08', '13:29');
    R.eq(r.raw, 576, 'LMA Test 6b: depart 13:29 → report 12:29, one minute before the window → no lunch, raw 576');
    R.eq(r.money, '$576.00', 'LMA Test 6b: formatMoney $576.00');

    // ---- v1.57.0 (B3, owner-ordered): period-correct pricing ----
    // The same trip prices with the agreement of its day. FS layover
    // 08:00 / 07:30 (SDPs 10.5 + 9.0, both ≤ 14h): the 2025–2027 ladder
    // pays 1.3× per sector; the 2022–2024 agreement paid 1.0×.
    R.eq(w.eval('RATES_TIMELINE.length'), 3, 'B3: the served rates.json installs three periods');
    swap({ name: 'B3', gender: 'M', rank: 'FS', firstSoloYMD: '2020-01-01' });
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Layover');
    set(d.getElementById(cid + '-ifa-fn1'), '3'); set(d.getElementById(cid + '-ifa-fn2'), '4');
    set(d.getElementById(cid + '-ifa-t1'), '08:00'); set(d.getElementById(cid + '-ifa-t2'), '07:30');
    set(d.getElementById(cid + '-ifa-d1'), '2024-06-03'); set(d.getElementById(cid + '-ifa-d2'), '2024-06-06');
    {
        const r24 = res(cid, 'both');
        R.eq(r24.detail.sectors[0].mult, 1, 'B3: a 2024 duty pays the 2022–2024 bracket (1.0×)');
        R.eq(r24.detail.sectors[1].mult, 1, 'B3: both 2024 sectors at 1.0×');
        R.eq(r24.ifaTotal, 209.25, 'B3: 2024 IFA total 209.25 (108.00 + 101.25)');
        R.ok(r24.period && /^Priced with the 2022–2024 agreement \(CA 057\/2022\)/.test(r24.period.text), 'B3: the 2024 result notes its agreement');
        R.ok(r24.period && /ULR lump sums not included/.test(r24.period.text), 'B3: the note carries the honest ULR skip');
        R.eq(r24.detail.directUSMultiplier, null, 'B3: the 2022–2024 agreement had no direct-US rate');
        R.eq(r24.detail.period && r24.detail.period.text, r24.period && r24.period.text, 'B3: the archived detail freezes the same note');
    }
    set(d.getElementById(cid + '-ifa-d1'), '2025-06-02'); set(d.getElementById(cid + '-ifa-d2'), '2025-06-05');
    {
        const r25 = res(cid, 'both');
        R.eq(r25.detail.sectors[0].mult, 1.3, 'B3: a 2025 duty pays the 2025–2027 bracket (1.3×)');
        R.eq(w.eval('computeCardResults("' + cid + '", "both").ifaTotal.toFixed(20)'), '272.02499999999997726263', 'B3: 2025 IFA total matches the current ladder (the stored …97726263 double)');
        R.ok(r25.period && /^Priced with the 2025–2027 agreement \(CA 058\/2025\)/.test(r25.period.text), 'B3: the 2025 result notes its agreement');
        R.ok(r25.period && !/ULR/.test(r25.period.text), 'B3: no ULR note on the 2025 agreement');
    }
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    R.eq(res(cid, 'both').period, null, 'B3: a current-agreement duty carries no note');
    set(d.getElementById(cid + '-ifa-d1'), '2021-06-07'); set(d.getElementById(cid + '-ifa-d2'), '2021-06-10');
    {
        // re-swap: a 2020 solo would still be inside the 24-month junior
        // window in 2021 — an older solo keeps the comparison apples-to-apples
        swap({ name: 'B3', gender: 'M', rank: 'FS', firstSoloYMD: '2000-01-01' });
        const r21 = res(cid, 'both');
        R.eq(r21.ifaTotal, 209.25, 'B3: a pre-2022 duty prices with the earliest rules (209.25)');
        R.ok(r21.period && /^Before 2022 — priced with the 2022–2024 agreement/.test(r21.period.text), 'B3: a pre-2022 duty says so honestly');
    }
    // the engine must come back exactly as it was after a foreign-period
    // call: the same card, re-dated to today's agreement, pays today's
    // ladder again (and the LMA block below proves the meal tables too)
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    R.eq(res(cid, 'both').detail.sectors[0].mult, 1.3, 'B3: the engine restores — the same card re-dated to 2026 pays the current ladder');

    // paxing across periods: 0.5× then, 0.75× now
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Layover');
    set(d.getElementById(cid + '-ifa-fn1'), '3'); set(d.getElementById(cid + '-ifa-fn2'), '4');
    set(d.getElementById(cid + '-ifa-d1'), '2024-06-03'); set(d.getElementById(cid + '-ifa-d2'), '2024-06-06');
    set(d.getElementById(cid + '-ifa-t1'), '08:00'); set(d.getElementById(cid + '-ifa-t2'), '07:30');
    tick(d.getElementById(cid + '-ifa-px1'));
    R.eq(res(cid, 'both').detail.sectors[0].mult, 0.5, 'B3: a 2024 paxing sector at the 2022 agreement half rate');
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    R.eq(res(cid, 'both').detail.sectors[0].mult, 0.75, 'B3: a 2026 paxing sector at the current rate');

    // direct-US under the 2022 agreement: no rate existed, so the flag
    // prices on the layover bracket instead
    cid = await newCard();
    set(d.getElementById(cid + '-flight-type'), 'Layover');
    set(d.getElementById(cid + '-ifa-fn1'), '21'); set(d.getElementById(cid + '-ifa-fn2'), '22');
    set(d.getElementById(cid + '-ifa-d1'), '2024-06-03'); set(d.getElementById(cid + '-ifa-d2'), '2024-06-06');
    set(d.getElementById(cid + '-ifa-t1'), '08:00'); set(d.getElementById(cid + '-ifa-t2'), '07:30');
    tick(d.getElementById(cid + '-ifa-us1')); tick(d.getElementById(cid + '-ifa-us2'));
    {
        const r24 = res(cid, 'both');
        R.eq(r24.detail.sectors[0].mult, 1, 'B3: a 2024 direct-US flag prices on the layover bracket (no 2022 direct-US rate)');
        R.ok(/Layover Bracket/.test(r24.detail.sectors[0].logic), 'B3: the sector logic says Layover Bracket, not Direct US Override');
        R.eq(r24.detail.directUSMultiplier, null, 'B3: the overview snapshot knows the period had no direct-US rate');
    }
    set(d.getElementById(cid + '-ifa-d1'), '2026-10-05'); set(d.getElementById(cid + '-ifa-d2'), '2026-10-08');
    {
        const r26 = res(cid, 'both');
        R.eq(r26.detail.sectors[0].mult, 3.5, 'B3: the same flag in 2026 pays the direct-US override');
        R.eq(r26.detail.directUSMultiplier, 3.5, 'B3: the overview snapshot carries the current direct-US rate');
    }

    // LMA vintages on real cards (a true LMA-only card has no IFA dates:
    // the first station's arrival date rules the period). NB: the suite's
    // :last-of-type helper returns the same long-lived both-card, so this
    // block takes the genuinely last card in DOM order.
    w.eval('renderCalculatorCard("lma")');
    await wait(150);
    const lmaCards = d.querySelectorAll('#chat-container [data-calc-card]');
    cid = lmaCards[lmaCards.length - 1].querySelector('input[id$="-lma-iata1"]').id.slice(0, -'-lma-iata1'.length);
    R.ok(!d.getElementById(cid + '-ifa-d1'), 'B3: the LMA-only card carries no IFA date to rule the period');
    r = await lma('NRT', '2024-06-03', '21:55', '2024-06-06', '12:15');
    R.eq(r.raw, 592, 'B3: NRT Mon→Thu 2024 at the Jan-2024 sheet (3×54 + 2×94 + 2×121 = 592)');
    R.ok(res(cid, 'lma').period && /2022–2024 agreement/.test(res(cid, 'lma').period.text), 'B3: the LMA-only result notes its period');
    r = await lma('NRT', '2025-06-02', '21:55', '2025-06-05', '12:15');
    R.eq(r.raw, 609, 'B3: the same NRT pattern in 2025 at the Jan-2025 sheet (3×55 + 2×97 + 2×125 = 609)');
    r = await lma('NRT', '2026-10-05', '21:55', '2026-10-08', '12:15');
    R.eq(r.raw, 576, 'B3: the same NRT pattern in 2026 at the current table (3×52 + 2×92 + 2×118 = 576)');

    process.exit(R.done() ? 1 : 0);
})().catch((e) => { console.error('SUITE CRASHED:', e); process.exit(2); });
