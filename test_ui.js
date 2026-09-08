const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<button[^>]*id="btn-onboarding-submit"[^>]*>[\s\S]*?<\/button>/;
const match = html.match(regex);
if (match) console.log(match[0]);

