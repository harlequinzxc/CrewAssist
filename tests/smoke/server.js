// Static server for the smoke rig: the real app (app.html), its compiled
// stylesheet, the repo rates.json, and the real sw.js for stamp checks.
const http = require('http');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const file = (url === '/' || url === '/app.html') ? path.join(__dirname, 'app.html')
        : url === '/tw.css' ? path.join(__dirname, 'tw.css')
        : url === '/rates.json' ? path.join(repo, 'rates.json')
        : url === '/sw.js' ? path.join(repo, 'sw.js')
        : null;
    if (!file || !fs.existsSync(file)) { res.writeHead(404).end('nope'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
    res.end(fs.readFileSync(file));
}).listen(8799, '0.0.0.0', () => console.log('smoke server on 8799'));
