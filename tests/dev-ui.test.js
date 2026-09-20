// Developer-mode UI: the Save/Export/Import footer anatomy, the Data Management
// pills (gold Reset above red Clear All Data) and the 10-tap dev-mode reveal.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
(async () => {
  const { w, d } = await boot(APP);
  const card = d.getElementById('settings-developer');
  const exp = d.getElementById('btn-dev-export');
  const imp = d.getElementById('btn-dev-import');

  // footer: two equal one-line buttons matching the Save button's language
  R.ok(exp && exp.className.includes('flex-1') && exp.className.includes('items-center') && !exp.className.includes('flex-col'), 'Export: equal-width one-line button');
  R.ok(imp && imp.className.includes('flex-1') && imp.className.includes('items-center') && !imp.className.includes('flex-col'), 'Import: equal-width one-line button');
  R.eq(exp.querySelector('i').getAttribute('data-lucide'), 'download', 'Export icon is download');
  R.eq(imp.querySelector('i').getAttribute('data-lucide'), 'upload', 'Import icon is upload');
  R.eq(exp.textContent.trim(), 'Export', 'Export label visible');
  R.ok(d.getElementById('btn-dev-save'), 'Save button still present');
  R.ok(!card.contains(d.getElementById('btn-dev-reset')), 'Reset no longer inside dev rates card');
  R.ok(imp.contains(d.getElementById('dev-file-import')), 'file input stays inside Import button');

  // Data Management: gold Reset above red Clear All Data, dev-gated
  const reset = d.getElementById('btn-dev-reset');
  const clear = d.getElementById('btn-clear-data');
  R.ok(reset.classList.contains('hidden'), 'Reset hidden when dev mode off');
  R.ok(reset.className.includes('text-sia-gold') && reset.className.includes('border-sia-gold'), 'Reset: gold text + gold border');
  R.ok(clear.className.includes('text-red-600') && clear.className.includes('border-red-500'), 'Clear All Data: red text + red border');
  R.ok(clear.className.includes('bg-transparent'), 'Clear All Data: transparent background');
  const order = Array.from(d.querySelectorAll('#btn-dev-reset, #btn-clear-data')).map((el) => el.id);
  R.eq(order.join(','), 'btn-dev-reset,btn-clear-data', 'Reset sits above Clear All Data');

  // the real 10-tap path reveals both the section and the pill
  for (let i = 0; i < 10; i++) d.getElementById('header-brand').click();
  await wait(50);
  R.ok(!reset.classList.contains('hidden'), '10 taps reveal Reset pill');
  R.ok(!card.classList.contains('hidden'), '10 taps reveal dev section');

  process.exit(R.done() ? 1 : 0);
})();
