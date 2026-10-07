// Builds app.html from the repo's index.html for the browser smoke rig
// (this folder lives inside the repo on purpose — it survives workspace restores).
//  - the unpkg lucide script becomes a local no-op stub (icons are cosmetic),
//  - the service-worker registration is stubbed (the SW's CDN precache would
//    fight the sandbox's blocked CDN hosts and spam the console),
//  - everything else — every script, the compiled ./tw.css link — is the
//    real app, untouched.
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
let html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

const lucideTag = '<script src="https://unpkg.com/lucide@latest"></script>';
if (!html.includes(lucideTag)) throw new Error('lucide tag not found — index.html changed');
html = html.replace(lucideTag, '<script>window.lucide = { createIcons() {} };</script>');

const headOpen = '<head>';
if (!html.includes(headOpen)) throw new Error('<head> not found');
html = html.replace(headOpen, headOpen + '\n    <script>if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return Promise.resolve({ scope: "/", addEventListener() {}, update() { return Promise.resolve(); }, unregister() { return Promise.resolve(); } }); };</script>');

fs.writeFileSync(path.join(__dirname, 'app.html'), html);
fs.copyFileSync(path.join(repo, 'tw.css'), path.join(__dirname, 'tw.css'));
console.log('app.html built:', html.length, 'bytes');
