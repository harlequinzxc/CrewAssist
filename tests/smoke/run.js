// One-shot runner for the smoke rig: extracts the chromium shared libs the
// sparticuz build needs (brotli-packed al2023.tar.br -> /tmp/chr-libs/lib),
// starts the static server on 8799, runs smoke.js, and tears both down.
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const libsDir = '/tmp/chr-libs/lib';
if (!fs.existsSync(path.join(libsDir, 'libnspr4.so'))) {
    fs.mkdirSync(libsDir, { recursive: true });
    const br = path.join(__dirname, 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br');
    fs.writeFileSync('/tmp/al2023.tar', zlib.brotliDecompressSync(fs.readFileSync(br)));
    execSync('tar -xf /tmp/al2023.tar -C /tmp/chr-libs');
    console.log('chromium libs extracted to', libsDir);
}

const server = spawn('node', [path.join(__dirname, 'server.js')], { stdio: 'inherit' });
const smoke = spawn('node', [path.join(__dirname, 'smoke.js')], { stdio: 'inherit' });
smoke.on('exit', (code) => { server.kill(); process.exit(code || 0); });
