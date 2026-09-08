const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /document.querySelectorAll\('\.ob-gender-btn'\)\.forEach\(btn => \{[\s\S]*?\}\);/;
const match = html.match(regex);
if (match) console.log(match[0]);
