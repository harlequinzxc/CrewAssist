const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Category Pills insertion
html = html.replace(
    `            const catPillsHtml = \`
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-3">
                    \${hasMeals ? \\\`<button onclick="switchMenuCategory('meals', this)" class="menu-cat-pill selected px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-sia-gold text-black border border-sia-gold flex items-center gap-1.5 shrink-0"><i data-lucide="utensils" class="w-4 h-4"></i> Meals</button>\\\` : ''}
                    \${hasDrinks ? \\\`<button onclick="switchMenuCategory('drinks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="glass-water" class="w-4 h-4"></i> Drinks</button>\\\` : ''}
                    \${hasSnacks ? \\\`<button onclick="switchMenuCategory('snacks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="cookie" class="w-4 h-4"></i> Snacks</button>\\\` : ''}
                    \${hasAmenities ? \\\`<button onclick="switchMenuCategory('amenities', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="sparkles" class="w-4 h-4"></i> Amenities</button>\\\` : ''}
                </div>
            \`;
            
            container.insertAdjacentHTML('beforeend', catPillsHtml);`,
    `            const catPillsHtml = \`
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-1">
                    \${hasMeals ? \\\`<button onclick="switchMenuCategory('meals', this)" class="menu-cat-pill selected px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-sia-gold text-black border border-sia-gold flex items-center gap-1.5 shrink-0"><i data-lucide="utensils" class="w-4 h-4"></i> Meals</button>\\\` : ''}
                    \${hasDrinks ? \\\`<button onclick="switchMenuCategory('drinks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="glass-water" class="w-4 h-4"></i> Drinks</button>\\\` : ''}
                    \${hasSnacks ? \\\`<button onclick="switchMenuCategory('snacks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="cookie" class="w-4 h-4"></i> Snacks</button>\\\` : ''}
                    \${hasAmenities ? \\\`<button onclick="switchMenuCategory('amenities', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="sparkles" class="w-4 h-4"></i> Amenities</button>\\\` : ''}
                </div>
            \`;
            
            const pillWrap = document.getElementById('menu-category-pills-wrap');
            if (pillWrap) pillWrap.innerHTML = catPillsHtml;`
);

// 2. Meal Tabs insertion & single meal logic
html = html.replace(
    `                // Build Tabs (Centered)
                let mealTabsHtml = '<div class="flex justify-center gap-6 border-b border-black/10 dark:border-white/10 overflow-x-auto scrollbar-hide py-2 mt-4">';
                meals.forEach((meal, idx) => {
                    mealTabsHtml += \\\`<button onclick="switchMealTab('\${idx}', this)" class="meal-tab-btn whitespace-nowrap pb-2 text-sm font-bold \${idx === 0 ? 'text-sia-gold border-b-2 border-sia-gold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'} transition-colors">\${meal.mealServiceName}</button>\\\`;
                });
                mealTabsHtml += '</div>';
                mealsWrap.insertAdjacentHTML('beforeend', mealTabsHtml);`,
    `                // Build Tabs (Centered)
                let mealTabsHtml = '';
                if (meals.length > 1) {
                    mealTabsHtml = '<div class="flex justify-center gap-6 border-b border-black/10 dark:border-white/10 overflow-x-auto scrollbar-hide py-2 mt-2">';
                    meals.forEach((meal, idx) => {
                        mealTabsHtml += \\\`<button onclick="switchMealTab('\${idx}', this)" class="meal-tab-btn whitespace-nowrap pb-2 text-sm font-bold \${idx === 0 ? 'text-sia-gold border-b-2 border-sia-gold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'} transition-colors">\${meal.mealServiceName}</button>\\\`;
                    });
                    mealTabsHtml += '</div>';
                }
                const tabsWrap = document.getElementById('menu-meal-tabs-wrap');
                if (tabsWrap) tabsWrap.innerHTML = mealTabsHtml;`
);

// 3. Ethnic Culinary fix
const oldCul = `                    culinaryOptions = firstMeal.selectionDetails.map(sel => {
                        let n = sel.name;
                        if(n.toLowerCase().includes('international menu')) n = 'International';
                        else if(n.toLowerCase().includes('ethnic menu')) n = 'Ethnic';
                        return n;
                    });`;
const newCul = `                    culinaryOptions = firstMeal.selectionDetails.map(sel => {
                        let n = sel.name;
                        if(n.toLowerCase().includes('international')) n = 'International';
                        else n = 'Ethnic';
                        return n;
                    });`;
html = html.replace(oldCul, newCul);

// 4. Update the Let's Go button string which failed earlier due to a regex mismatch? Let me check the Let's Go button directly in the HTML.
fs.writeFileSync('index.html', html);
console.log('Done');
