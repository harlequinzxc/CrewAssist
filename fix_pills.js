const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /const catPillsHtml = `[\s\S]*?container\.insertAdjacentHTML\('beforeend', catPillsHtml\);/;

const newStr = `const catPillsHtml = \`
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-3">
                    \${hasMeals ? \\\`<button onclick="switchMenuCategory('meals', this)" class="menu-cat-pill selected px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-sia-gold text-black border border-sia-gold flex items-center gap-1.5 shrink-0"><i data-lucide="utensils" class="w-4 h-4"></i> Meals</button>\\\` : ''}
                    \${hasDrinks ? \\\`<button onclick="switchMenuCategory('drinks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="glass-water" class="w-4 h-4"></i> Drinks</button>\\\` : ''}
                    \${hasSnacks ? \\\`<button onclick="switchMenuCategory('snacks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="cookie" class="w-4 h-4"></i> Snacks</button>\\\` : ''}
                    \${hasAmenities ? \\\`<button onclick="switchMenuCategory('amenities', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="sparkles" class="w-4 h-4"></i> Amenities</button>\\\` : ''}
                </div>
            \`;
            
            const pillWrap = document.getElementById('menu-category-pills-wrap');
            if (pillWrap) {
                pillWrap.innerHTML = catPillsHtml;
            } else {
                container.insertAdjacentHTML('beforeend', catPillsHtml);
            }`;

html = html.replace(regex, newStr);
fs.writeFileSync('index.html', html);
console.log('Fixed pills');
