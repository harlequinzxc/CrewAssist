const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The "Showing Menu for" wasn't removed because my regex didn't catch it when I ran the fix_dropdown_html script? 
// Let's remove it AND fix the fact that `openMenuViewerForCabins` tries to set it.
// The new redesign places the "SQ11 - TUESDAY, 8 SEPTEMBER 2026" directly inside `renderSector` in the Hero Card.
// Therefore, `openMenuViewerForCabins` does NOT need to update `menu-display-header`.

const newOpenMenu = `        function openMenuViewerForCabins(flightNumber, date, cabinClasses) {
            currentMenuSearch.selectedCabins = cabinClasses;
            const backdrop = document.getElementById('menu-backdrop');
            const sheet = document.getElementById('menu-sheet');
            
            const cabinWrap = document.getElementById('menu-cabin-wrap');
            const cabinList = document.getElementById('menu-cabin-list');
            const cabinLabel = document.getElementById('menu-cabin-label');
            cabinList.innerHTML = '';
            
            const cabinNames = { 'FCL': 'First', 'JCL': 'Business', 'SCL': 'Premium Eco', 'YCL': 'Economy' };
            
            if (cabinClasses.length > 1) {
                cabinWrap.classList.remove('hidden');
                cabinClasses.forEach(code => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors';
                    btn.textContent = cabinNames[code] || code;
                    btn.onclick = () => {
                        cabinLabel.textContent = cabinNames[code] || code;
                        toggleMenuDropdown('cabin');
                        loadMenu(code);
                    };
                    cabinList.appendChild(btn);
                });
                cabinLabel.textContent = cabinNames[cabinClasses[0]] || cabinClasses[0];
            } else {
                cabinWrap.classList.add('hidden');
            }
            
            loadMenu(cabinClasses[0]);
            
            backdrop.classList.remove('hidden');
            setTimeout(() => {
                backdrop.classList.remove('opacity-0');
                sheet.classList.remove('translate-y-full');
            }, 10);
        }`;

html = html.replace(/function openMenuViewerForCabins\([\s\S]*?translate-y-full'\);\n            \}, 10\);\n        \}/, newOpenMenu);


// Now fix the HTML structure
const badHeaderHTML = `<div class="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                        <div>
                            <div class="text-sm text-gray-500">Showing Menu for</div>
                            <div class="font-bold" id="menu-display-header">SQ -- • Cabin</div>
                        </div>
                        
                    </div>`;

html = html.replace(badHeaderHTML, '');

fs.writeFileSync('index.html', html);
