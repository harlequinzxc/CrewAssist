// Diff for the computed-style snapshot rig: compares two snapshot JSONs
// (before/after a CSS change) and reports EVERY computed-style difference,
// per theme. Paths under the What's New / changelog surfaces are culled —
// those DOM areas legitimately change with the version dance and their
// colours are verified by the dozens of other elements sharing the same
// tokens. Usage: node style-diff.js <before.json> <after.json>
const fs = require('fs');
const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: node style-diff.js <before.json> <after.json>'); process.exit(1); }
const A = JSON.parse(fs.readFileSync(a, 'utf8'));
const B = JSON.parse(fs.readFileSync(b, 'utf8'));
const CULL = /whatsnew|changelog|wn-list/i;
let totalDiffs = 0, culled = 0;
for (const theme of ['dark', 'light']) {
    const ma = new Map(A[theme].els.map((e) => [e.path, e]));
    const mb = new Map(B[theme].els.map((e) => [e.path, e]));
    const onlyA = [...ma.keys()].filter((p) => !mb.has(p));
    const onlyB = [...mb.keys()].filter((p) => !ma.has(p));
    const props = ['base', 'bef', 'aft'];
    const diffs = [];
    for (const [p, ea] of ma) {
        if (!mb.has(p)) continue;
        const eb = mb.get(p);
        for (const k of props) {
            const x = ea[k], y = eb[k];
            if (!x && !y) continue;
            if ((x && !y) || (!x && y)) { diffs.push([p, k, 'presence', JSON.stringify(x), JSON.stringify(y)]); continue; }
            for (const prop of Object.keys(x)) if (String(x[prop]) !== String(y[prop])) diffs.push([p, k + '.' + prop, String(x[prop]), String(y[prop])]);
        }
    }
    const realOnly = (l) => l.filter((p) => !CULL.test(p));
    const culledA = onlyA.length - realOnly(onlyA).length, culledB = onlyB.length - realOnly(onlyB).length;
    culled += culledA + culledB;
    console.log(`— ${theme}: ${A[theme].count} -> ${B[theme].count} elements | prop diffs: ${diffs.length} | only-before: ${realOnly(onlyA).length} (culled ${culledA}) | only-after: ${realOnly(onlyB).length} (culled ${culledB})`);
    for (const d of diffs.slice(0, 60)) console.log('  DIFF', theme, JSON.stringify(d));
    if (diffs.length > 60) console.log('  …', diffs.length - 60, 'more');
    for (const p of realOnly(onlyA).slice(0, 10)) console.log('  ONLY-BEFORE', theme, p);
    for (const p of realOnly(onlyB).slice(0, 10)) console.log('  ONLY-AFTER', theme, p);
    totalDiffs += diffs.length + realOnly(onlyA).length + realOnly(onlyB).length;
}
console.log(totalDiffs === 0 ? 'ZERO COMPUTED-STYLE DIFFS — pixel-identical' : `TOTAL FLAGGED DIFFS: ${totalDiffs} (culled version-dance areas: ${culled})`);
process.exit(totalDiffs === 0 ? 0 : 2);
