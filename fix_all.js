const fs = require('fs');

// We are on commit d24507f (the one where the frontend code was pulled from `git show 3561c70:index.html`).
// Wait, the user said "previous build still works". The previous build was `1efdea4`.
// In `1efdea4`, the CORS PROXY was removed and Vercel Edge Proxy was restored.
// And `icons/` was tracked. In this detached head, `icons/` is UNTRACKED. That's why the logo doesn't display.
// AND in this detached head, it's probably using the broken Vercel Edge code or `corsproxy.io`? Let's check index.html!

let html = fs.readFileSync('index.html', 'utf8');
if (html.includes('corsproxy.io')) {
    console.log('USING CORSPROXY');
} else {
    console.log('USING API/SQ');
}
