const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. CTA Buttons ("Let's Go", "Menu", "Print") modification
html = html.replace(
    `class="w-full py-3.5 px-4 rounded-full text-sm font-bold bg-gradient-to-r from-sia-goldlt to-sia-gold text-black disabled:opacity-50 disabled:grayscale transition-all shadow-[0_0_20px_rgba(201,162,39,0.2)] flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(201,162,39,0.4)]"`,
    `class="w-full py-4 px-4 rounded-full text-sm uppercase tracking-widest font-bold bg-sia-navy dark:bg-black text-sia-gold border border-sia-gold disabled:opacity-50 disabled:grayscale transition-all shadow-lg flex items-center justify-center gap-2 hover:bg-sia-gold hover:text-black dark:hover:bg-sia-gold dark:hover:text-black"`
);
// Make Menu/Print buttons similarly distinct from pills
html = html.replace(
    `class="flex-1 bg-sia-navy dark:bg-sia-gold dark:text-black text-white font-bold rounded-xl py-2.5 shadow-sm flex justify-center items-center gap-2 transition-transform active:scale-95 text-xs"`,
    `class="flex-1 bg-sia-navy dark:bg-[#0b1a3a] text-sia-gold border border-sia-gold font-bold rounded-full py-3 shadow-lg flex justify-center items-center gap-2 transition-transform active:scale-95 text-xs uppercase tracking-widest"`
);
html = html.replace(
    `class="flex-1 \${mode === 'print' ? 'bg-sia-navy dark:bg-sia-gold dark:text-black text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10'} font-bold rounded-xl py-2.5 shadow-sm transition-transform active:scale-95 text-xs flex justify-center items-center gap-2"`,
    `class="flex-1 \${mode === 'print' ? 'bg-sia-navy dark:bg-[#0b1a3a] text-sia-gold border border-sia-gold shadow-lg' : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-500'} font-bold rounded-full py-3 transition-transform active:scale-95 text-xs flex justify-center items-center gap-2 uppercase tracking-widest"`
);

// 2. Fetching menu from seat pocket text
html = html.replace(
    `<div class="text-sm font-semibold text-gray-500 animate-pulse">Loading Inflight Data...</div>`,
    `<div class="text-sm font-semibold text-gray-500 animate-pulse">Fetching menu from seat pocket...</div>`
);

// 3. Gap at the top of the route hero card
html = html.replace(
    `<div class="px-6 py-6 overflow-y-auto max-w-2xl mx-auto w-full space-y-6 flex-grow" id="menu-content">`,
    `<div class="px-6 pt-4 pb-6 overflow-y-auto max-w-2xl mx-auto w-full space-y-6 flex-grow" id="menu-content">`
);

// 4. Sticky Header restructuring
const oldMenuState = `<div id="menu-state-3" class="hidden space-y-4">
                    
                    <div id="menu-offline-badge" class="hidden flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <i data-lucide="wifi-off" class="w-4 h-4"></i> Offline copy • may be outdated
                    </div>

                    <div id="menu-hero-content" class="mb-4"></div>
                    <!-- Filter Dropdowns -->
                    <div class="flex gap-2 relative z-20 items-start">`;

const newMenuState = `<div id="menu-state-3" class="hidden space-y-4">
                    
                    <div id="menu-offline-badge" class="hidden flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <i data-lucide="wifi-off" class="w-4 h-4"></i> Offline copy • may be outdated
                    </div>

                    <div id="menu-hero-content" class="mb-4"></div>
                    
                    <!-- Sticky Header Container -->
                    <div id="menu-sticky-header" class="sticky top-0 z-40 bg-[var(--glass-sheet-bg)] pb-2 -mx-6 px-6 shadow-[0_15px_15px_-15px_rgba(0,0,0,0.3)] transition-all duration-300">
                        <!-- Filter Dropdowns -->
                        <div class="flex gap-2 relative z-20 items-start pt-2">`;

html = html.replace(oldMenuState, newMenuState);

const oldDropdownEnd = `</div>
                    </div>
                    
                    <!-- Sector Content -->`;
const newDropdownEnd = `</div>
                        
                        <!-- Dynamic Pills & Tabs Injected Here -->
                        <div id="menu-category-pills-wrap"></div>
                        <div id="menu-meal-tabs-wrap"></div>
                    </div>
                    
                    <!-- Sector Content -->`;
html = html.replace(oldDropdownEnd, newDropdownEnd);

fs.writeFileSync('index.html', html);
console.log('UI structures updated.');
