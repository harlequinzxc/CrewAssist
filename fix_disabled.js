const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The class contains disabled:opacity-50 disabled:grayscale
html = html.replace(/disabled:grayscale/g, 'disabled:grayscale disabled:pointer-events-none');

fs.writeFileSync('index.html', html);
