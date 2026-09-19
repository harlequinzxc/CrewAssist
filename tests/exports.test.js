// Cross-platform exports: PC/Mac always download; iPhone/iPad share natively;
// Android shares JSON as a .txt twin (Chrome gates shareable files by filename
// extension) and falls back to download only on a genuine refusal.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36';
const setupExport = (w) => {
    w.URL.createObjectURL = () => 'blob:test';
    w.URL.revokeObjectURL = () => {};
    w.__clicks = [];
    w.HTMLAnchorElement.prototype.click = function () { w.__clicks.push(this.download); };
};

(async () => {
  // PC (no navigator.share): every export downloads with its real name
  {
    const { w, d } = await boot(APP);
    setupExport(w);
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates(); // clean -> no confirm
    await wait(80);
    R.ok(w.__clicks.indexOf('crewassist-rates.json') !== -1, 'PC: dev rates export downloads');

    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'JNB/CPT', amount: 100 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    w.archDoExport('json');
    await wait(80);
    R.ok(w.__clicks.some((n) => /^crewassist-earnings-.*\.json$/.test(n)), 'PC: archive JSON export downloads');
    w.archDoExport('csv');
    await wait(80);
    R.ok(w.__clicks.some((n) => /^crewassist-earnings-.*\.csv$/.test(n)), 'PC: archive CSV export downloads');
    R.eq(d.getElementById('dev-file-import').getAttribute('accept'), '.json,.txt,application/json,text/plain', 'import picker accepts .txt twins');
  }

  // iPhone: native share sheet, .json name kept, cancel delivers nothing
  {
    const { w } = await boot(APP);
    setupExport(w);
    Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', configurable: true });
    w.navigator.canShare = () => true;
    w.__shared = null;
    w.navigator.share = async (data) => { w.__shared = data; };
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates();
    await wait(80);
    R.ok(w.__shared && w.__shared.files && w.__shared.files.length === 1, 'iOS: dev rates export uses share sheet');
    R.eq(w.__shared && w.__shared.files[0].name, 'crewassist-rates.json', 'iOS: shared file name keeps .json');
    R.eq(w.__shared && w.__shared.files[0].type, 'application/json', 'iOS: shared file type');
    R.eq(w.__clicks.length, 0, 'iOS: no anchor download fallback');

    w.navigator.share = async () => { const e = new Error('abort'); e.name = 'AbortError'; throw e; };
    const ok = await w.exportFile(new w.Blob(['{}'], { type: 'application/json' }), 'x.json');
    R.eq(ok, false, 'iOS: cancelled share returns false');
    R.eq(w.__clicks.length, 0, 'iOS: cancel triggers no download');
  }

  // Android, canShare permissive: original .json shares
  {
    const { w } = await boot(APP);
    setupExport(w);
    Object.defineProperty(w.navigator, 'userAgent', { value: ANDROID_UA, configurable: true });
    w.navigator.canShare = () => true;
    w.__shared = null;
    w.navigator.share = async (data) => { w.__shared = data; };
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates();
    await wait(80);
    R.ok(w.__shared && w.__shared.files[0].name === 'crewassist-rates.json', 'Android(permissive): share panel with rates file');
    R.eq(w.__clicks.length, 0, 'Android(permissive): no direct download when sharing');
  }

  // Mac desktop: always download, share never used even when available
  {
    const { w } = await boot(APP);
    setupExport(w);
    Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15', configurable: true });
    w.navigator.canShare = () => true;
    w.__shared = null;
    w.navigator.share = async (data) => { w.__shared = data; };
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates();
    await wait(80);
    R.ok(w.__clicks.indexOf('crewassist-rates.json') !== -1, 'Mac: direct download to Downloads');
    R.ok(!w.__shared, 'Mac: share panel never used');
  }

  // Android, Chrome extension whitelist: JSON shares as the .txt twin; Word keeps .doc
  {
    const { w } = await boot(APP);
    setupExport(w);
    Object.defineProperty(w.navigator, 'userAgent', { value: ANDROID_UA, configurable: true });
    w.navigator.canShare = (dd) => /\.(txt|csv|png|jpe?g|gif|pdf|mp3|mp4|webm)$/i.test(dd.files[0].name);
    w.__shared = null;
    w.navigator.share = async (data) => { w.__shared = data; };
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates();
    await wait(80);
    R.ok(w.__shared && w.__shared.files[0].name === 'crewassist-rates.txt', 'Android(whitelist): rates shared as .txt twin');
    R.eq(w.__shared && w.__shared.files[0].type, 'text/plain', 'Android(whitelist): .txt twin typed text/plain');
    R.eq(w.__clicks.length, 0, 'Android(whitelist): no silent download for rates export');

    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'JNB/CPT', amount: 100 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    w.archDoExport('json');
    await wait(80);
    R.ok(w.__shared && /\.txt$/.test(w.__shared.files[0].name), 'Android(whitelist): archive JSON shares as .txt');

    const res = await w.exportFile(new w.Blob(['<html></html>'], { type: 'application/msword' }), 'menu.doc');
    R.eq(res, 'menu.doc', 'Android(whitelist): word export keeps .doc name');
    R.ok(w.__shared && w.__shared.files[0].name === 'menu.doc', 'Android(whitelist): word shared as .doc, never renamed to .txt');
  }

  // Android, canShare refuses EVERYTHING: share still attempted directly;
  // genuine rejection downloads; user cancel delivers nothing
  {
    const { w } = await boot(APP);
    setupExport(w);
    Object.defineProperty(w.navigator, 'userAgent', { value: ANDROID_UA, configurable: true });
    w.navigator.canShare = () => false;
    w.__shared = null;
    w.navigator.share = async (data) => { w.__shared = data; };
    w.renderDevRatesEditor();
    await wait(50);
    w.exportDevRates();
    await wait(80);
    R.ok(w.__shared && w.__shared.files[0].name === 'crewassist-rates.txt', 'Android(refusing): rates still share as .txt twin');
    R.eq(w.__clicks.length, 0, 'Android(refusing): no silent download when share succeeds');

    w.navigator.share = async () => { const e = new Error('type'); e.name = 'TypeError'; throw e; };
    const res = await w.exportFile(new w.Blob(['{}'], { type: 'application/json' }), 'x.json');
    R.eq(res, 'x.json', 'Android: real refusal falls back to download');
    R.ok(w.__clicks.indexOf('x.json') !== -1, 'Android: refusal downloads original name');

    w.navigator.share = async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; };
    const res2 = await w.exportFile(new w.Blob(['{}'], { type: 'application/json' }), 'y.json');
    R.eq(res2, false, 'Android: share cancel returns false');
    R.ok(w.__clicks.indexOf('y.json') === -1, 'Android: cancel triggers no download');
  }

  process.exit(R.done() ? 1 : 0);
})();
