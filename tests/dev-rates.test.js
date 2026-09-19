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

  // import fills fields + marks dirty, never saves
  const before = w.localStorage.getItem('crewAssist.rates');
  const file = new w.File([JSON.stringify({ version: 1, ifa: { sgBuffer: 5 } })], 'r.json', { type: 'application/json' });
  w.importDevRatesFile(file);
  await wait(300);
  R.ok(!d.getElementById('dev-dirty-dot').classList.contains('hidden'), 'import marks dirty');
  R.eq(w.localStorage.getItem('crewAssist.rates'), before, 'import does not auto-save');
  R.ok(dotOf(d.querySelector('[data-ifa-field="sgBuffer"]')).classList.contains('is-on'), 'import: section dot on');

  // reset to defaults: confirm dialog, then defaults applied (still unsaved)
  const initialVal = '2.5'; // shipped rates.json == code defaults for this field
  w.resetDevRates();
  await wait(50);
  R.ok(!d.getElementById('app-dialog-backdrop').classList.contains('hidden'), 'reset opens confirm pop-up');
  R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Reset rates to defaults') !== -1, 'reset confirm wording');
  d.getElementById('app-dialog-ok').click();
  await wait(400);
  R.eq(d.querySelector('[data-ifa-field="sgBuffer"]').value, initialVal, 'OK restores default rates');

  process.exit(R.done() ? 1 : 0);
})();
