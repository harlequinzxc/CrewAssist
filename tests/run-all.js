// Runs every *.test.js suite in this directory sequentially and summarises.
// Usage: node tests/run-all.js   (or: npm test, from this directory)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => /\.test\.js$/.test(f)).sort();
if (!files.length) { console.log('no suites found'); process.exit(1); }

let failed = 0;
for (const f of files) {
    const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000 });
    const out = (r.stdout || '').toString().trim();
    const summary = out.split('\n').filter((l) => /passed/.test(l)).pop() || '(no summary)';
    const ok = r.status === 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.padEnd(28)} ${summary}`);
    if (!ok) {
        failed++;
        console.log('      ' + out.split('\n').slice(0, 6).join('\n      '));
    }
}
console.log(`\n${files.length - failed}/${files.length} suites passed`);
process.exit(failed ? 1 : 0);
