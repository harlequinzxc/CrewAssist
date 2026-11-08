// Dev-mode rates editor: the snapshot/dirty state machine, section dots,
// save flash, import (fills + dirty, never saves) and reset-to-defaults.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
(async () => {
  const { w, d } = await boot(APP);
  w.renderDevRatesEditor();
  await wait(50);
  const save = d.getElementById('btn-dev-save');
  const dotOf = (el) => el.closest('.dev-rate-card').querySelector('.dev-sec-dot');

  // clean state
  R.ok(save.disabled, 'clean: save disabled');
  R.ok(d.getElementById('dev-dirty-dot').classList.contains('hidden'), 'clean: dot hidden');
  const inp = d.querySelector('[data-ifa-field="sgBuffer"]');
  const secDot = dotOf(inp);
  R.ok(secDot && !secDot.classList.contains('is-on'), 'clean: section dot off');

  // edit -> dirty
  inp.value = '99';
  inp.dispatchEvent(new w.Event('input', { bubbles: true }));
  await wait(50);
  R.ok(!save.disabled, 'dirty: save enabled');
  R.ok(!d.getElementById('dev-dirty-dot').classList.contains('hidden'), 'dirty: dot visible');
  R.ok(!d.getElementById('dev-dirty-label').classList.contains('hidden'), 'dirty: label visible');
  const row = inp.closest('tr');
  R.ok(row.classList.contains('dev-row-edited'), 'dirty row gold border');
  R.ok(!!row.querySelector('.dev-edited-tag'), 'dirty row EDITED tag');
  R.ok(secDot.classList.contains('is-on'), 'dirty: section dot on (collapsed accordion)');

  // save -> flash -> clean again (editor re-renders: re-query afterwards)
  await w.saveDevRates();
  R.ok(w.localStorage.getItem('crewAssist.rates'), 'save persists to localStorage');
  R.ok(save.classList.contains('is-saved'), 'saved flash style');
  await wait(1600);
  R.ok(save.disabled, 'after save returns clean/disabled');
  R.ok(d.getElementById('dev-dirty-dot').classList.contains('hidden'), 'after save dot cleared');
  R.ok(!dotOf(d.querySelector('[data-ifa-field="sgBuffer"]')).classList.contains('is-on'), 'after save: section dot off');

  // v1.41.0: the rates import folded into Settings → Restore backup. A rates
  // file through the door confirms, then APPLIES (it is a restore action,
  // not an editor fill) — and the engine picks the values up at once.
  const before = w.localStorage.getItem('crewAssist.rates');
  const ratesTxt = JSON.stringify(JSON.stringify({ version: 1, ifa: { sgBuffer: 5 } }));
  w.eval('backupRestoreRead("r.json", ' + ratesTxt + ')');
  await wait(80);
  R.ok(!d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'a rates file opens the confirm door');
  R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Rates file') !== -1, 'the rates confirm says what it will do');
  R.eq(w.localStorage.getItem('crewAssist.rates'), before, 'cancel-safe: nothing written before OK');
  d.getElementById('app-dialog-cancel').click();
  await wait(80);
  R.eq(w.localStorage.getItem('crewAssist.rates'), before, 'cancel leaves the rates untouched');
  w.eval('backupRestoreRead("r.json", ' + ratesTxt + ')');
  await wait(80);
  d.getElementById('app-dialog-ok').click();
  await wait(200);
  const restored = JSON.parse(w.localStorage.getItem('crewAssist.rates') || 'null');
  R.ok(restored && restored.ifa && restored.ifa.sgBuffer === 5, 'OK applies the rates to crewAssist.rates');
  R.eq(w.eval('readRatesFromEditor().ifa.sgBuffer'), 5, 'the live editor reflects the restored buffer at once');

  // reset to defaults: confirm dialog, then defaults applied (still unsaved)
  const initialVal = '2.5'; // shipped rates.json == code defaults for this field
  w.resetDevRates();
  await wait(50);
  R.ok(!d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'reset opens confirm pop-up');
  R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Reset rates to default') !== -1, 'reset confirm wording (hotfix: singular)');
  d.getElementById('app-dialog-ok').click();
  await wait(400);
  R.eq(d.querySelector('[data-ifa-field="sgBuffer"]').value, initialVal, 'OK restores default rates');

  // ---- v1.33.0: rates remember when they were last edited ----
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.ratesUpdatedAt', String(Date.now() - 3600 * 1000));
    }});
    w.renderDevRatesEditor();
    await wait(50);
    const stamp = d.querySelector('#dev-rates-root > p.ca-micro.font-bold');
    R.ok(stamp && /Rates last edited /.test(stamp.textContent), 'the editor stamps when rates were last edited');
    R.ok(stamp && !/NaN|Invalid/.test(stamp.textContent), 'the stamp formats as a real timestamp');
  }

  // ---- v1.45.11: the Monthly salary section rides the rates editor ----
  // CA 058/2025 clauses 35/37: laundry 125, transport 340, midnight 32, CPF 20%
  // are editor-editable modifiers like any other, and parseRates carries them
  // through storage so a legacy rates blob without the block still boots.
  {
    const salField = (k) => d.querySelector('[data-salary-field="' + k + '"]');
    const { w, d } = await boot(APP);
    w.renderDevRatesEditor();
    await wait(50);
    R.ok(!!salField('laundry') && !!salField('transport') && !!salField('midnight') && !!salField('cpfPct'), 'the salary section renders its four modifiers');
    R.eq(salField('laundry').value, '125', 'laundry default 125');
    R.eq(salField('transport').value, '340', 'transport default 340');
    R.eq(salField('midnight').value, '32', 'midnight default 32');
    R.eq(salField('cpfPct').value, '20', 'CPF default 20%');
    const save2 = d.getElementById('btn-dev-save');
    R.ok(save2.disabled, 'clean: save disabled before a salary edit');
    salField('cpfPct').value = '18';
    salField('cpfPct').dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    R.ok(!save2.disabled, 'a salary edit dirties the editor like any section');
    await w.saveDevRates();
    await wait(100);
    const stored = JSON.parse(w.localStorage.getItem('crewAssist.rates'));
    R.ok(stored && stored.salary && stored.salary.cpfPct === 18 && stored.salary.laundry === 125, 'save persists the salary block with the edit');
    w.close();
  }
  {
    // a legacy rates blob (pre-1.45.11, no salary key) parses with defaults
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.rates', JSON.stringify({ version: 1, ifa: { sgBuffer: 3 }, lma: { regions: {}, windows: {} } }));
    }});
    w.renderDevRatesEditor();
    await wait(50);
    R.eq(d.querySelector('[data-salary-field="cpfPct"]').value, '20', 'a legacy blob without the salary key parses back to CPF 20');
    R.eq(d.querySelector('[data-ifa-field="sgBuffer"]').value, '3', 'the legacy IFA edit survives the same parse');
    void d;
  }

  // ---- Period-correct pricing (v1.57.0, B3): rates.json is a timeline ----
  {
    // clean boot: the served v2 file installs three periods; the editor and
    // engine ride the current one; the current agreement never notes
    const { w, d } = await boot(APP);
    await wait(400);
    R.eq(w.eval('RATES_TIMELINE.length'), 3, 'B3: the served v2 file installs three periods');
    R.eq(w.eval('RATES_TIMELINE[0].validFrom'), '2022-01-01', 'B3: the first period starts at the 2022 agreement');
    R.eq(w.eval('RATES_TIMELINE[1].validFrom'), '2025-01-01', 'B3: the second period starts at the 2025 agreement');
    R.eq(w.eval('RATES_TIMELINE[2].validFrom'), '2026-01-01', 'B3: the last period starts at 2026');
    R.eq(w.eval('RATES_TIMELINE[0].label'), 'the 2022\u20132024 agreement (CA 057/2022)', 'B3: the 2022 period carries its agreement label');
    R.eq(w.eval('RATES_TIMELINE[0].note'), 'ULR lump sums not included', 'B3: the 2022 period carries the honest ULR note');
    R.eq(w.eval('RATES_TIMELINE[1].note'), '', 'B3: the 2025 period carries no note');
    R.eq(w.eval('readRatesFromEditor().ifa.paxingMultiplier'), 0.75, 'B3: the editor (and engine) ride the current period');
    R.eq(w.eval('periodNoteFor(ratesPeriodFor("2026-06-01"))'), null, 'B3: the current agreement never notes');
    R.eq(w.eval('ratesPeriodFor("1999-01-01").beforeFirst'), true, 'B3: a duty before the earliest period flags before-first');
    R.ok(w.eval('periodNoteFor(ratesPeriodFor("2021-06-01")).text.indexOf("Before 2022") === 0'), 'B3: the before-first note says Before 2022');
    R.ok(w.eval('periodNoteFor(ratesPeriodFor("2024-06-01")).text.indexOf("Priced with the 2022\u20132024 agreement") === 0'), 'B3: a 2024 duty notes the 2022 agreement');
    R.ok(w.eval('periodNoteFor(ratesPeriodFor("2024-06-01")).text.indexOf("ULR lump sums not included") !== -1'), 'B3: the 2024 note carries the ULR skip');

    // parseRatesTimeline unit pins: flat v1 is one always-current period
    R.eq(w.eval('parseRatesTimeline({ version: 1, ifa: { sgBuffer: 5 } }).length'), 1, 'B3: a flat v1 blob parses as one period');
    R.eq(w.eval('parseRatesTimeline({ version: 1, ifa: { sgBuffer: 5 } })[0].validFrom'), '0000-01-01', 'B3: the flat period is always-current (override semantics)');
    R.eq(w.eval('parseRatesTimeline(null) === null'), true, 'B3: garbage in, null out');
    R.eq(w.eval('parseRatesTimeline({ version: 2, periods: [] }) === null'), true, 'B3: an empty periods array is null, not a crash');
    R.eq(w.eval('parseRatesTimeline({ version: 2, periods: [{ validFrom: "June 2024", ifa: {} }, { validFrom: "2024-01-01", ifa: {} }] }).length'), 1, 'B3: a malformed validFrom is skipped');
    R.eq(w.eval('parseRatesTimeline({ version: 2, periods: [{ validFrom: "2025-01-01", ifa: {} }, { validFrom: "2022-01-01", ifa: {} }] })[0].validFrom'), '2022-01-01', 'B3: periods sort ascending no matter the file order');
    // the 2022 null direct-US rate must survive parsing (numOr(null) trap)
    R.eq(w.eval('parseRates({ version: 1, ifa: { directUSMultiplier: null } }).ifa.directUSMultiplier'), null, 'B3: a JSON null direct-US rate parses as null, not the default');

    // the editor still edits the CURRENT period, and exporting keeps the
    // whole timeline (publishing is the export door's job)
    w.renderDevRatesEditor();
    await wait(50);
    R.eq(w.eval('buildExportRates(readRatesFromEditor()).version'), 2, 'B3: the export stays a v2 timeline');
    R.eq(w.eval('buildExportRates(readRatesFromEditor()).periods.length'), 3, 'B3: exporting keeps all three periods');
    R.eq(w.eval('buildExportRates(readRatesFromEditor()).periods[0].validFrom'), '2022-01-01', 'B3: the exported timeline keeps the 2022 period');
    R.ok(w.eval('buildExportRates(readRatesFromEditor()).periods[0].ifa.directUSMultiplier == null'), 'B3: the exported 2022 period keeps no direct-US rate');

    // a device save collapses the timeline to one always-current override
    const inp2 = d.querySelector('[data-ifa-field="sgBuffer"]');
    inp2.value = '4';
    inp2.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(50);
    await w.saveDevRates();
    await wait(100);
    R.eq(w.eval('RATES_TIMELINE.length'), 1, 'B3: a device save is a flat override — one period');
    R.eq(w.eval('RATES_TIMELINE[0].validFrom'), '0000-01-01', 'B3: the override period is always-current');
    R.eq(w.eval('periodNoteFor(ratesPeriodFor("2024-06-01"))'), null, 'B3: an override wins everywhere — no period notes');
    R.eq(w.eval('buildExportRates(readRatesFromEditor()).version'), 1, 'B3: an override device exports the flat rates it runs');

    // reset truly discards: storage cleared, served timeline back
    w.resetDevRates();
    await wait(50);
    d.getElementById('app-dialog-ok').click();
    await wait(400);
    R.eq(w.eval('localStorage.getItem("crewAssist.rates") === null'), true, 'B3: reset clears the stored override');
    R.eq(w.eval('RATES_TIMELINE.length'), 3, 'B3: reset restores the served timeline');
    R.eq(d.querySelector('[data-ifa-field="sgBuffer"]').value, '2.5', 'B3: reset restores the current period\u2019s buffer');

    // a restored v2 file lives as a timeline on that device
    const v2file = JSON.stringify(JSON.stringify({ version: 2, periods: [
      { validFrom: '2022-01-01', label: 'the 2022\u20132024 agreement (CA 057/2022)', note: 'ULR lump sums not included', ifa: { paxingMultiplier: 0.5, directUSMultiplier: null } },
      { validFrom: '2026-01-01', label: 'the 2025\u20132027 agreement (CA 058/2025)', ifa: { sgBuffer: 6 } }
    ] }));
    w.eval('backupRestoreRead("r.json", ' + v2file + ')');
    await wait(80);
    d.getElementById('app-dialog-ok').click();
    await wait(200);
    R.eq(w.eval('RATES_TIMELINE.length'), 2, 'B3: a restored v2 file installs its periods on this device');
    R.eq(w.eval('RATES_TIMELINE[0].validFrom'), '2022-01-01', 'B3: the restored timeline sorts ascending');
    R.eq(w.eval('periodNoteFor(ratesPeriodFor("2024-06-01")).text.indexOf("ULR lump sums not included") !== -1'), true, 'B3: the restored 2022 period still notes the ULR skip');
    R.eq(d.querySelector('[data-ifa-field="sgBuffer"]').value, '6', 'B3: the restored current period reaches the editor');

    // boot reads the stored timeline back (the reload path)
    {
      const stored = w.eval('localStorage.getItem("crewAssist.rates")');
      const { w: w2 } = await boot(APP, { seed: (x) => { x.localStorage.setItem('crewAssist.rates', stored); } });
      await wait(400);
      R.eq(w2.eval('RATES_TIMELINE.length'), 2, 'B3: a stored v2 blob boots back as a timeline');
      R.eq(w2.eval('periodNoteFor(ratesPeriodFor("2024-06-01")).text.indexOf("2022\u20132024") !== -1'), true, 'B3: the booted-back timeline still prices 2024 with 2022 rules');
      w2.close();
    }
    w.close();
  }

  process.exit(R.done() ? 1 : 0);
})();
