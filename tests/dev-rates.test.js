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
  R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Reset rates to defaults') !== -1, 'reset confirm wording');
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

  process.exit(R.done() ? 1 : 0);
})();
