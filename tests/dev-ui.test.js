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

  // v1.29.0: two-tap clear-chat + calculator Enter-advance + keypad coverage
  {
    const { w, d } = await boot(APP, { seed: (x) => {
      x.localStorage.setItem('crewAssist.profile', JSON.stringify({ name: 'Test Tan', gender: 'M', rank: 'FS' }));
      x.localStorage.setItem('crewAssist.tourOffered', '1');
      x.localStorage.setItem('crewAssist.tourDone', '1');
    } });
    await wait(3500); // fast lane: greeting settles
    const resetBtn = d.getElementById('btn-reset');
    const firstBubble = d.getElementById('chat-container').firstElementChild;
    resetBtn.click();
    await wait(100);
    R.ok(resetBtn.classList.contains('ca-twotap-armed'), 'first clear-chat tap arms red, nothing cleared');
    R.ok(firstBubble && firstBubble.isConnected, 'the conversation survives the first tap');
    resetBtn.click();
    await wait(3000);
    R.ok(!firstBubble.isConnected, 'the second tap clears the chat');
    R.ok(/, FS Test!/.test(d.getElementById('chat-container').textContent), 'and the greeting re-types');

    // Enter hops to the next calculator field; every text field has a keypad
    w.renderCalculatorCard('both');
    await wait(120);
    const card = d.querySelector('[data-calc-card]');
    R.ok(!!card, 'calculator card renders');
    const fields = Array.from(card.querySelectorAll('input.ui-input')).filter((i) => i.type === 'text');
    R.ok(fields.length >= 2, 'card has text fields');
    R.ok(fields.every((i) => /iata/.test(i.id) || i.getAttribute('inputmode')), 'every numeric calculator field summons a keypad; station-code fields are letters');
    const first = fields[0];
    first.focus();
    first.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(50);
    R.ok(d.activeElement === fields[1], 'Enter advances to the next field');
    void d;
  }

  // v1.31.0: the UX-review release — labelled pill, aria, type floor, ink, hit areas
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    R.ok(!/text-\[(9|9\.5|10|11)px\]/.test(src), 'nothing renders below the 11px type floor');
    R.ok(src.includes('.ca-micro { font-size: 11px; }'), 'the micro tier is one token');
    R.ok(src.includes('--sia-gold-ink: #7d650f') && src.includes('html:not(.dark) .text-sia-gold'), 'light-mode gold text uses the measured ink');
    R.ok(src.includes('min-w-[88px]') && src.includes("actionText = { save: 'Save', check: 'Saved'"), 'the save action is a labelled pill');
    R.ok(src.includes('.ca-hit::after'), 'invisible hit-area growth exists');
    R.ok(src.includes('py-3.5 text-xs font-bold whitespace-nowrap'), 'quick-action chips reach the 44px class');
    R.ok(src.includes("div.setAttribute('aria-hidden', 'true');"), 'the typing dots stay quiet for screen readers');
    R.eq(d.getElementById('chat-container').getAttribute('role'), 'log', 'the chat is a live log');
    R.eq(d.getElementById('chat-container').getAttribute('aria-live'), 'polite', 'bot narration is announced politely');
    R.eq(d.getElementById('results-sheet').getAttribute('role'), 'dialog', 'the summary sheet is a dialog');
    R.eq(d.getElementById('settings-sheet').getAttribute('aria-modal'), 'true', 'settings reads as modal');
    // the pill keeps its shape across states (owner ruling)
    w.eval('setResultsAction("save", false)');
    const ab = d.getElementById('btn-results-action');
    R.ok(ab.textContent === 'Save' && ab.className.indexOf('min-w-[88px]') !== -1, 'save state reads Save');
    w.eval('setResultsAction("check", false)');
    R.ok(ab.textContent === 'Saved' && ab.className.indexOf('min-w-[88px]') !== -1, 'saved state reads Saved — same footprint');
    // the tour is one Settings tap away
    d.getElementById('btn-settings').click();
    await wait(150);
    const rp = d.getElementById('btn-replay-tour');
    R.ok(rp && rp.textContent.indexOf('Replay') !== -1, 'Settings offers the feature tour replay');
    rp.click();
    R.ok(w.caTour.on === true, 'replay starts the tour');
    w.eval('finishCaTour(true)');
    await wait(150);
    R.ok(w.caTour.on === false, 'the replayed tour ends cleanly');
    void d;
  }

  // v1.31.1: fixes from the owner's device pass
  {
    const fs = require('fs');
    const src = fs.readFileSync(APP, 'utf8');
    // the calculator interface selector follows the chosen mode (the Default
    // pill was missing its id, so it never un-selected)
    w.eval('setCalcUiMode("manual")');
    await wait(60);
    const dPill = d.getElementById('calcui-pill-default');
    const mPill = d.getElementById('calcui-pill-manual');
    R.ok(dPill && !dPill.classList.contains('bg-sia-gold') && dPill.getAttribute('aria-checked') === 'false', 'Default un-selects when Manual is chosen');
    R.ok(mPill && mPill.classList.contains('bg-sia-gold') && mPill.getAttribute('aria-checked') === 'true', 'Manual takes the selection');
    w.eval('setCalcUiMode("default")');
    await wait(60);
    R.ok(dPill.classList.contains('bg-sia-gold') && dPill.getAttribute('aria-checked') === 'true', 'Default re-selects on return');
    // toasts: gold border always, bright pill in dark mode
    R.ok(src.includes('border: 1.5px solid #d4af37'), 'every toast carries a gold border');
    R.ok(src.includes('.dark .ca-arch-toast { background: #f6f1e8; color: #171d2b; }'), 'dark mode toasts invert to a bright pill');
    R.ok(src.includes('.ca-arch-toast .ca-toast-undo'), 'the Undo action keeps a readable gold in both themes');
    void d;
  }

  process.exit(R.done() ? 1 : 0);
})();
