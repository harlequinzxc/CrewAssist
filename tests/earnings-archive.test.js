// Earnings archive: SIN-only route stripping, real-current-month expansion,
// and the settings-style delete confirmation with undo-safe cancel.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
(async () => {
  // route display + month expansion
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-10-29T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-29', stationDisplay: 'JNB/SIN', amount: 100 },
      { id: 'M', savedAt: '2026-10-20T10:00:00Z', monthKey: '2026-10', sectorDate: '2026-10-20', stationDisplay: 'JNB/CPT', amount: 50 },
      { id: 'S', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'NRT/LAX', amount: 70 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    const txt = d.getElementById('ca-arch-list').textContent;
    R.ok(txt.includes('JNB') && !txt.includes('JNB/SIN'), 'SIN stripped from turnaround');
    R.ok(txt.includes('JNB/CPT') && txt.includes('NRT/LAX'), 'multisector kept');
    const grp = (mk) => d.querySelector('.ca-arch-group-head[data-mk="' + mk + '"]').closest('.ca-arch-group');
    const sepG = grp('2026-09'), octG = grp('2026-10');
    R.ok(sepG && !sepG.classList.contains('ca-arch-collapsed'), 'current real month (Sep) expanded');
    R.ok(octG && octG.classList.contains('ca-arch-collapsed'), 'future month (Oct) collapsed');
  }

  // delete confirmation: settings-style pop-up, OK deletes, Cancel keeps
  {
    const { w, d } = await boot(APP);
    const seed = () => w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'T', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', stationDisplay: 'JNB/CPT', amount: 100 }
    ]));
    seed();
    w.showArchiveOverlay();
    await wait(100);
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    const backdrop = d.getElementById('app-dialog-backdrop');
    R.ok(!backdrop.classList.contains('hidden'), 'delete opens settings-style dialog');
    R.ok(d.getElementById('app-dialog-msg').textContent.indexOf('Delete 1 entry') !== -1, 'dialog message wording');
    R.ok(!d.getElementById('app-dialog-cancel').classList.contains('hidden'), 'dialog has Cancel button');
    d.getElementById('app-dialog-ok').click();
    await wait(400); // the dialog fades out over 200ms before 'hidden' lands
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 0, 'OK deletes the entry');
    R.ok(backdrop.classList.contains('hidden'), 'dialog closes after OK');

    seed();
    w.showArchiveOverlay();
    await wait(100);
    d.getElementById('ca-arch-trash').click();
    await wait(50);
    d.getElementById('app-dialog-cancel').click();
    await wait(100);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'Cancel keeps the entry');
  }

  process.exit(R.done() ? 1 : 0);
})();
