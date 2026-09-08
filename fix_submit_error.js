const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The `submitFlightVerification` calls `openMenuViewerForCabins`.
// `openMenuViewerForCabins` has `document.getElementById('menu-display-header').textContent = ...`
// BUT I replaced `menu-display-header` in the redesign! There is NO `menu-display-header` anymore!
// Let me verify if `menu-display-header` exists.

console.log(html.includes('id="menu-display-header"'));
