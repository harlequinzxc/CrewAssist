const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The sticky header isn't sticking because `menu-content` is the overflow-y-auto container, not `body` or `window`. 
// For sticky elements to work inside an overflow container, they must be direct children or have the correct stacking context within that container.
// The `menu-state-3` div is a block that contains `menu-sticky-header`, and `menu-state-3` has `space-y-4` which may break flex/sticky.
// We need to move the sticky header properties or structure. Let's fix this in CSS or restructure.

const target = `<div id="menu-sticky-header" class="sticky top-0 z-40 bg-[var(--glass-sheet-bg)] pb-2 -mx-6 px-6 shadow-[0_15px_15px_-15px_rgba(0,0,0,0.3)] transition-all duration-300">`;
const replacement = `<div id="menu-sticky-header" class="sticky top-[-16px] z-40 bg-[var(--glass-sheet-bg)] pb-2 -mx-6 px-6 shadow-[0_15px_15px_-15px_rgba(0,0,0,0.3)] transition-all duration-300">`;

html = html.replace(target, replacement);
fs.writeFileSync('index.html', html);
