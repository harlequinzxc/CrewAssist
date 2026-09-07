const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Rank Container Animation Fix
html = html.replace(
    /<div id="ob-rank-container" class="opacity-50 pointer-events-none transition-opacity hidden">/,
    '<div id="ob-rank-container" class="opacity-0 max-h-0 overflow-hidden pointer-events-none transition-all duration-500">'
);

// In renderRanks function
html = html.replace(
    /container\.classList\.remove\('hidden', 'opacity-50', 'pointer-events-none'\);/,
    "container.classList.remove('opacity-0', 'max-h-0', 'pointer-events-none');\n            container.classList.add('opacity-100', 'max-h-[200px]', 'pointer-events-auto');"
);
html = html.replace(
    /const rc = document\.getElementById\('ob-rank-container'\);\n                rc\.classList\.add\('hidden', 'opacity-50', 'pointer-events-none'\);/,
    "const rc = document.getElementById('ob-rank-container');\n                rc.classList.add('opacity-0', 'max-h-0', 'pointer-events-none');\n                rc.classList.remove('opacity-100', 'max-h-[200px]', 'pointer-events-auto');"
);

// 2. Custom Dropdowns in Calculator
const oldSelects = \`                        <div class="flex gap-2 mb-3">
                            <select id="\\\${id}-flight-type" class="ui-input flex-1 rounded-xl py-2 px-3 text-xs font-bold focus:border-sia-gold outline-none">
                                <option value="Layover">Layover</option>
                                <option value="Turnaround">Turnaround</option>
                            </select>
                            <select id="\\\${id}-sector-count" class="ui-input flex-1 rounded-xl py-2 px-3 text-xs font-bold focus:border-sia-gold outline-none">
                                <option value="2">2 Sectors</option>
                                <option value="4">4 Sectors</option>
                            </select>
                        </div>\`;

const newSelects = \`                        <div class="flex gap-2 mb-3 z-10 relative">
                            <!-- Flight Type Custom Dropdown -->
                            <div class="flex-1 relative">
                                <button type="button" id="\\\${id}-flight-type-btn" class="ui-input w-full rounded-xl py-2 px-3 text-xs font-bold flex justify-between items-center transition-colors">
                                    <span id="\\\${id}-flight-type-label">Layover</span>
                                    <i data-lucide="chevron-down" class="w-3 h-3 transition-transform duration-300" id="\\\${id}-flight-type-icon"></i>
                                </button>
                                <input type="hidden" id="\\\${id}-flight-type" value="Layover">
                                <div id="\\\${id}-flight-type-menu" class="absolute top-full left-0 w-full mt-1 bg-white dark:bg-[#0b1a3a] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-xl max-h-0 opacity-0 pointer-events-none transition-all duration-300 z-20">
                                    <div class="p-1 flex flex-col gap-1">
                                        <button type="button" class="w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="selectDropdown('\\\${id}', 'flight-type', 'Layover', 'Layover')">Layover</button>
                                        <button type="button" class="w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="selectDropdown('\\\${id}', 'flight-type', 'Turnaround', 'Turnaround')">Turnaround</button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Sector Count Custom Dropdown -->
                            <div class="flex-1 relative">
                                <button type="button" id="\\\${id}-sector-count-btn" class="ui-input w-full rounded-xl py-2 px-3 text-xs font-bold flex justify-between items-center transition-colors">
                                    <span id="\\\${id}-sector-count-label">2 Sectors</span>
                                    <i data-lucide="chevron-down" class="w-3 h-3 transition-transform duration-300" id="\\\${id}-sector-count-icon"></i>
                                </button>
                                <input type="hidden" id="\\\${id}-sector-count" value="2">
                                <div id="\\\${id}-sector-count-menu" class="absolute top-full left-0 w-full mt-1 bg-white dark:bg-[#0b1a3a] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-xl max-h-0 opacity-0 pointer-events-none transition-all duration-300 z-20">
                                    <div class="p-1 flex flex-col gap-1">
                                        <button type="button" class="w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="selectDropdown('\\\${id}', 'sector-count', '2', '2 Sectors')">2 Sectors</button>
                                        <button type="button" class="w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="selectDropdown('\\\${id}', 'sector-count', '4', '4 Sectors')">4 Sectors</button>
                                    </div>
                                </div>
                            </div>
                        </div>\`;

html = html.replace(oldSelects, newSelects);

// Add selectDropdown function
const jsTarget = "function bindCalculatorEvents(id, mode) {";
const dropdownFunc = `
        window.selectDropdown = function(id, type, value, labelText) {
            document.getElementById(id + '-' + type).value = value;
            document.getElementById(id + '-' + type + '-label').innerText = labelText;
            
            // Close menu
            const menu = document.getElementById(id + '-' + type + '-menu');
            const icon = document.getElementById(id + '-' + type + '-icon');
            menu.classList.remove('opacity-100', 'max-h-[200px]', 'pointer-events-auto');
            menu.classList.add('opacity-0', 'max-h-0', 'pointer-events-none');
            icon.classList.remove('rotate-180');
            
            // Trigger change event to update sectors
            const inp = document.getElementById(id + '-' + type);
            inp.dispatchEvent(new Event('change'));
        };

        function bindCalculatorEvents(id, mode) {
            // Bind dropdown toggles
            if (mode === 'ifa' || mode === 'both') {
                ['flight-type', 'sector-count'].forEach(type => {
                    const btn = document.getElementById(id + '-' + type + '-btn');
                    if(btn) {
                        btn.addEventListener('click', () => {
                            const menu = document.getElementById(id + '-' + type + '-menu');
                            const icon = document.getElementById(id + '-' + type + '-icon');
                            const isClosed = menu.classList.contains('max-h-0');
                            
                            // Close others
                            document.querySelectorAll('[id$="-menu"]').forEach(m => {
                                m.classList.remove('opacity-100', 'max-h-[200px]', 'pointer-events-auto');
                                m.classList.add('opacity-0', 'max-h-0', 'pointer-events-none');
                            });
                            document.querySelectorAll('[id$="-icon"]').forEach(i => i.classList.remove('rotate-180'));
                            
                            if (isClosed) {
                                menu.classList.remove('opacity-0', 'max-h-0', 'pointer-events-none');
                                menu.classList.add('opacity-100', 'max-h-[200px]', 'pointer-events-auto');
                                icon.classList.add('rotate-180');
                            }
                        });
                    }
                });
            }
`;

html = html.replace(jsTarget, dropdownFunc);

fs.writeFileSync('index.html', html);
console.log("UI updates complete.");
