const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const match = html.match(/<div id="menu-sheet"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<script>/);
if (match) {
    console.log(match[0].substring(0, 2000));
} else {
    console.log('Not found');
}
