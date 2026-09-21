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

  // empty archive: the earnings page opens anyway, no dead-end bubbles
  {
    const { w, d } = await boot(APP);
    w.analyzeIntent('archive');
    await wait(1600); // overlay at 400ms; the greeting bubble types for up to ~900ms
    const chatTxt = d.getElementById('chat-container').textContent;
    R.ok(!/piggy bank is empty/i.test(chatTxt), 'no piggy-bank bubble');
    R.ok(!/keep track of everything/i.test(chatTxt), 'no follow-up guidance bubble');
    R.ok(/Pulling up your earnings/.test(chatTxt), 'the opening bubble still greets');
    R.ok(!d.getElementById('ca-arch-backdrop').classList.contains('hidden'), 'earnings page opens with nothing saved');
    const listTxt = d.getElementById('ca-arch-list').textContent;
    R.ok(/No flights yet/.test(listTxt), 'empty state heading');
    R.ok(/Run a COP calculation and hit save or tap the import arrow/.test(listTxt), 'empty state names both ways to fill it');
  }

  // tap-through: rows reopen the saved summary; old entries say so honestly
  {
    const { w, d } = await boot(APP);
    w.localStorage.setItem('crewAssist.archive', JSON.stringify([
      { id: 'NEW', savedAt: '2026-09-15T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-15', flightType: 'Layover', stationDisplay: 'KTM', amount: 360.72,
        detail: { v: 1, type: 'Layover', sectorCount: 2, rankRate: 13.5, tripSdpHm: '14H 11M', ifaTotal: 178.72, lmaTotal: 182, grandTotal: 360.72, bonusCount: 0, bonusAmount: 0,
          sectors: [
            { fn: '442', ftHm: '4H 56M', sdpHm: '7H 26M', mult: 1.3, amount: 86.58, paxing: false, directUs: false, isSg: true, dep: 'SIN', arr: 'KTM', depYmd: '2026-09-15', logic: 'Layover Bracket (SDP 7H 26M)' },
            { fn: '441', ftHm: '5H 15M', sdpHm: '6H 45M', mult: 1.3, amount: 92.14, paxing: false, directUs: false, isSg: false, dep: 'KTM', arr: 'SIN', depYmd: '2026-09-16', logic: 'Layover Bracket (SDP 6H 45M)' }
          ],
          stations: [ { code: 'KTM', region: 'South Asia', inYmd: '2026-09-15', inHm: '21:55', outYmd: '2026-09-16', outHm: '22:59', total: 182, shuttle: false, skipped: '',
            days: [ { ymd: '2026-09-15', b: 0, l: 0, d: 0, cost: 0 }, { ymd: '2026-09-16', b: 1, l: 1, d: 1, cost: 182 } ] } ],
          meals: { b: 1, l: 1, d: 1, bAmt: 36, lAmt: 64, dAmt: 82 } } },
      { id: 'OLD', savedAt: '2026-09-10T10:00:00Z', monthKey: '2026-09', sectorDate: '2026-09-10', stationDisplay: 'HKT', amount: 154.35 }
    ]));
    w.showArchiveOverlay();
    await wait(100);
    const rows = d.querySelectorAll('.ca-arch-row');
    R.eq(rows.length, 2, 'rows render with tap targets');
    // sorted desc by sectorDate: NEW (15th) first, OLD (10th) second
    rows[1].click();
    await wait(400);
    const sub = d.getElementById('ca-arch-sub');
    const sheetTxt = d.getElementById('ca-arch-sub-sheet').textContent;
    R.ok(!sub.classList.contains('hidden'), 'tapping a row opens the summary sheet');
    R.ok(/Saved before detailed summaries/.test(sheetTxt), 'old entry says so honestly');
    R.ok(/154\.35/.test(sheetTxt), 'old entry still shows its total');
    d.querySelector('[data-ca-arch-sub-close]').click();
    await wait(400);
    R.ok(sub.classList.contains('hidden'), 'summary sheet closes');
    // the detailed entry reopens the whole summary
    d.querySelectorAll('.ca-arch-row')[0].click();
    await wait(400);
    const txt2 = d.getElementById('ca-arch-sub-sheet').textContent;
    R.ok(/Flight Overview/.test(txt2), 'detailed entry shows the Flight Overview');
    R.ok(/Kathmandu overnight/.test(txt2), 'overview reads in the personal voice');
    R.ok(/IFA Breakdown/.test(txt2) && /LMA Breakdown/.test(txt2), 'breakdowns rebuilt from the snapshot');
    R.ok(/SQ 442/.test(txt2) && /SQ 441/.test(txt2), 'flight numbers in the breakdown');
    R.ok(/Saved /.test(txt2), 'saved-at footer');
    // the X deletes immediately (undo toast) without opening the sheet
    d.querySelector('[data-ca-arch-sub-close]').click();
    await wait(400);
    d.querySelector('.ca-arch-row .ca-arch-del').click();
    await wait(100);
    R.eq(JSON.parse(w.localStorage.getItem('crewAssist.archive')).length, 1, 'X deletes the entry straight away');
    R.ok(/Deleted/.test(d.getElementById('ca-arch-toast').textContent), 'undo toast confirms the delete');
    R.ok(d.getElementById('ca-arch-sub').classList.contains('hidden'), 'X does not open the summary sheet');
  }

  process.exit(R.done() ? 1 : 0);
})();
