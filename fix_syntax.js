const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/\\\`<button onclick="switchMenuCategory/g, '`<button onclick="switchMenuCategory');
html = html.replace(/<\/button>\\\`/g, '</button>`');

fs.writeFileSync('index.html', html);
console.log('Fixed syntax error in pills');
