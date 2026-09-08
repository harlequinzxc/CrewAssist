const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Calculate Button Validation logic
// The user said: "calculate button validation still not working properly (when nothing is filled up, grey out button can still be click) - when all text and time input is filled, button doesnt unlock"
// A button with `disabled` attribute cannot be clicked. The `disabled` attribute works native in HTML.
// Let's check `btn-calc` HTML.

const validateInputsStr = `            // Add Validation function
            const validateInputs = () => {
                let allFilled = true;
                const container = document.getElementById(id + '-cop-ifa-val').parentNode.parentNode;
                const textInputs = container.querySelectorAll('input[type="text"]');
                textInputs.forEach(inp => {
                    // Check if it's visible (not hidden by sector logic)
                    if(inp.offsetParent !== null && !inp.classList.contains('hidden')) {
                        // For time inputs we want 5 chars (HH:MM)
                        if(inp.value.trim() === '' || inp.value.length < 4) allFilled = false;
                    }
                });
                const calcBtn = document.getElementById(id + '-btn-calc');
                if (allFilled) {
                    calcBtn.disabled = false;
                } else {
                    calcBtn.disabled = true;
                }
            };`;

const newValidateInputsStr = `            // Add Validation function
            const validateInputs = () => {
                let allFilled = true;
                const container = document.getElementById(id + '-cop-ifa-val').parentNode.parentNode;
                const textInputs = container.querySelectorAll('input[type="text"]');
                textInputs.forEach(inp => {
                    // Check if the input is actually visible
                    if (!inp.closest('.hidden')) {
                        if (inp.value.trim() === '' || inp.value.length < 4) {
                            allFilled = false;
                        }
                    }
                });
                const calcBtn = document.getElementById(id + '-btn-calc');
                if (calcBtn) {
                    calcBtn.disabled = !allFilled;
                }
            };`;

html = html.replace(validateInputsStr, newValidateInputsStr);

// 2. Chat auto scroll for menu and print buttons on cabin selection
// In `checkCabinsSelected`:
const checkCabinsStr = `        function checkCabinsSelected(id) {
            const cabinContainer = document.getElementById(\`fv-cabins-container-\${id}\`);
            const selected = cabinContainer.querySelectorAll('.selected-cabin');
            const actions = document.getElementById(\`fv-actions-section-\${id}\`);
            
            if (selected.length > 0) {
                actions.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
            } else {
                actions.classList.add('opacity-50', 'pointer-events-none');
            }
        }`;

const newCheckCabinsStr = `        function checkCabinsSelected(id) {
            const cabinContainer = document.getElementById(\`fv-cabins-container-\${id}\`);
            const selected = cabinContainer.querySelectorAll('.selected-cabin');
            const actions = document.getElementById(\`fv-actions-section-\${id}\`);
            
            if (selected.length > 0) {
                const wasHidden = actions.classList.contains('opacity-50');
                actions.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
                if (wasHidden) scrollToBottom();
            } else {
                actions.classList.add('opacity-50', 'pointer-events-none');
            }
        }`;

html = html.replace(checkCabinsStr, newCheckCabinsStr);

// 3. Category pills
const pillsStr = `            // 2. Category Pills (Centered + Icons)
            const catPillsHtml = \`
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-3">
                    \${hasMeals ? \\\`<button onclick="switchMenuCategory('meals', this)" class="menu-cat-pill selected px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-sia-gold text-black border border-sia-gold flex items-center gap-1.5 shrink-0"><i data-lucide="utensils" class="w-4 h-4"></i> Meals</button>\\\` : ''}
                    \${hasDrinks ? \\\`<button onclick="switchMenuCategory('drinks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="glass-water" class="w-4 h-4"></i> Drinks</button>\\\` : ''}
                    \${hasSnacks ? \\\`<button onclick="switchMenuCategory('snacks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="cookie" class="w-4 h-4"></i> Snacks</button>\\\` : ''}
                    \${hasAmenities ? \\\`<button onclick="switchMenuCategory('amenities', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="sparkles" class="w-4 h-4"></i> Amenities</button>\\\` : ''}
                </div>
            \`;
            
            container.insertAdjacentHTML('beforeend', catPillsHtml);`;

const newPillsStr = `            // 2. Category Pills (Centered + Icons)
            const catPillsHtml = \`
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-1">
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

html = html.replace(pillsStr, newPillsStr);


// 4. Inflight menu category sticking - The user said category should be between dropdown and meal tab.
// It already is in HTML (`menu-category-pills-wrap` then `menu-meal-tabs-wrap`). The issue was it was being appended to `container` instead.

fs.writeFileSync('index.html', html);
console.log('Fixed js logic.');
