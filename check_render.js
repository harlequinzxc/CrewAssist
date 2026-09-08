        function renderSector(leg) {
            const container = document.getElementById('menu-sector-content');
            container.innerHTML = '';
            
            // 1. Flight Details Header (Redesigned Hero Card)
            const fd = leg.flightDetails;
            const dur = formatDuration(fd.departureUtcDate, fd.arrivalUtcDate);
            const dayShift = getDayShift(fd.departureLocalDate, fd.arrivalLocalDate);
            const depTime = fd.departureLocalDate.substring(11, 16);
            const arrTime = fd.arrivalLocalDate.substring(11, 16);
            
            const dObj = new Date(currentMenuSearch.date + 'T00:00:00');
            const dateDisplay = dObj.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).toUpperCase();
            const topHeader = `SQ${currentMenuSearch.flightNumber} - ${dateDisplay}`;
            
            const headerHtml = `
                <div class="bg-gradient-to-br from-sia-navy to-black dark:from-[#081021] dark:to-black text-white rounded-3xl p-5 relative overflow-hidden shadow-xl border border-white/10 mb-4">
                    <div class="text-center text-[10px] uppercase tracking-[0.2em] font-bold text-sia-gold mb-5 opacity-90">
                        ${topHeader}
                    </div>
                    <div class="flex justify-between items-start relative z-10">
                        <!-- Left Zone: Origin -->
                        <div class="flex flex-col flex-1 items-end text-right">
                            <div class="text-3xl font-bold tracking-tight">${fd.departureAirportCode}</div>
                            <div class="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold mb-3 truncate pl-2 w-full">${fd.departureCityName}</div>
                            <div class="text-2xl font-bold">${depTime}</div>
                        </div>
                        
                        <!-- Center Zone: Dotted Arc + Plane + Duration -->
                        <div class="flex flex-col items-center justify-center flex-[1.2] relative pt-2 px-2">
                            <!-- Dotted Arc -->
                            <div class="w-full h-12 absolute top-2 border-t-2 border-dotted border-white/20 rounded-[100%]"></div>
                            <!-- Plane Icon centered exactly on arc apex -->
                            <div class="absolute -top-1 text-sia-gold">
                                <i data-lucide="plane" class="w-5 h-5 fill-current"></i>
                            </div>
                            <!-- Duration Pill -->
                            <div class="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider mt-10">
                                ${dur}
                            </div>
                        </div>
                        
                        <!-- Right Zone: Destination -->
                        <div class="flex flex-col items-start flex-1 text-left">
                            <div class="text-3xl font-bold tracking-tight">${fd.arrivalAirportCode}</div>
                            <div class="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold mb-3 truncate pr-2 w-full">${fd.arrivalCityName}</div>
                            <div class="text-2xl font-bold relative">
                                ${arrTime}
                                ${dayShift ? `<span class="absolute -top-1 -right-6 text-[10px] text-sia-gold font-bold">${dayShift}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const hc = document.getElementById('menu-hero-content');
            if (hc) hc.innerHTML = headerHtml;
            else container.insertAdjacentHTML('beforeend', headerHtml);

            const hasMeals = leg.menu && leg.menu.language && leg.menu.language.EN_UK && leg.menu.language.EN_UK.meals && leg.menu.language.EN_UK.meals.length > 0;
            const hasDrinks = leg.beverage && leg.beverage.language && leg.beverage.language.EN_UK && leg.beverage.language.EN_UK.categories && leg.beverage.language.EN_UK.categories.length > 0;
            const hasSnacks = leg.drySnack && leg.drySnack.category && leg.drySnack.category.subcategories && leg.drySnack.category.subcategories.length > 0;
            const hasAmenities = leg.amenities && leg.amenities.items && leg.amenities.items.length > 0;

            // Culinary Dropdown check
            let culinaryOptions = [];
            if (hasMeals) {
                const firstMeal = leg.menu.language.EN_UK.meals[0];
                if (firstMeal && firstMeal.selectionDetails && firstMeal.selectionDetails.length > 1) {
                    culinaryOptions = firstMeal.selectionDetails.map(sel => {
                        let n = sel.name;
                        if(n.toLowerCase().includes('international menu')) n = 'International';
                        else if(n.toLowerCase().includes('ethnic menu')) n = 'Ethnic';
                        return n;
                    });
                }
            }

            const culinaryWrap = document.getElementById('menu-culinary-wrap');
            if (culinaryOptions.length > 0) {
                const culinaryList = document.getElementById('menu-culinary-list');
                const culinaryLabel = document.getElementById('menu-culinary-label');
                culinaryList.innerHTML = '';
                
                let defaultIdx = 0;
                culinaryOptions.forEach((opt, idx) => {
                    if (opt === 'International') defaultIdx = idx;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-full text-left py-2 px-3 text-xs font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors';
                    btn.textContent = opt;
                    btn.onclick = () => {
                        culinaryLabel.textContent = opt;
                        toggleMenuDropdown('culinary');
                        switchCulinarySelection(idx);
                    };
                    culinaryList.appendChild(btn);
                });
                culinaryLabel.textContent = culinaryOptions[defaultIdx];
                culinaryWrap.classList.remove('hidden');
                
                setTimeout(() => { switchCulinarySelection(defaultIdx); }, 10);
            } else {
                culinaryWrap.classList.add('hidden');
            }

            // 2. Category Pills (Centered + Icons)
            const catPillsHtml = `
                <div class="flex justify-center flex-wrap gap-2 py-1 mt-3">
                    ${hasMeals ? `<button onclick="switchMenuCategory('meals', this)" class="menu-cat-pill selected px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-sia-gold text-black border border-sia-gold flex items-center gap-1.5 shrink-0"><i data-lucide="utensils" class="w-4 h-4"></i> Meals</button>` : ''}
                    ${hasDrinks ? `<button onclick="switchMenuCategory('drinks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="glass-water" class="w-4 h-4"></i> Drinks</button>` : ''}
                    ${hasSnacks ? `<button onclick="switchMenuCategory('snacks', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="cookie" class="w-4 h-4"></i> Snacks</button>` : ''}
                    ${hasAmenities ? `<button onclick="switchMenuCategory('amenities', this)" class="menu-cat-pill px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-1.5 shrink-0"><i data-lucide="sparkles" class="w-4 h-4"></i> Amenities</button>` : ''}
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', catPillsHtml);
            
            // Build wrappers
            const wrapHtml = `
                <div id="menu-cat-meals" class="menu-cat-section space-y-4"></div>
                <div id="menu-cat-drinks" class="menu-cat-section hidden space-y-4"></div>
                <div id="menu-cat-snacks" class="menu-cat-section hidden space-y-4"></div>
                <div id="menu-cat-amenities" class="menu-cat-section hidden space-y-4"></div>
            `;
            container.insertAdjacentHTML('beforeend', wrapHtml);
            
            const mealsWrap = container.querySelector('#menu-cat-meals');
            const drinksWrap = container.querySelector('#menu-cat-drinks');
            const snacksWrap = container.querySelector('#menu-cat-snacks');
            const amWrap = container.querySelector('#menu-cat-amenities');
            
            // Flags
            if (leg.isNoMenuPlanned) {
                mealsWrap.insertAdjacentHTML('beforeend', `<div class="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-xl text-sm border border-blue-500/20">Menu may change prior to departure.</div>`);
            }
            if (leg.isSnackBag) {
                mealsWrap.insertAdjacentHTML('beforeend', `<div class="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-3 rounded-xl text-sm border border-purple-500/20">This sector operates a snack bag service instead of a full meal service.</div>`);
            }
            if (leg.isBentoBox) {
                mealsWrap.insertAdjacentHTML('beforeend', `<div class="bg-orange-500/10 text-orange-600 dark:text-orange-400 p-3 rounded-xl text-sm border border-orange-500/20">This sector operates a Bento Box service.</div>`);
            }
            if (leg.isHawkerPromo) {
                mealsWrap.insertAdjacentHTML('beforeend', `<div class="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-500/20">Special Hawker Promo Menu Available.</div>`);
            }
            if (leg.guestChef && leg.guestChef.header) {
                mealsWrap.insertAdjacentHTML('beforeend', `<div class="bg-sia-gold/10 text-sia-gold p-3 rounded-xl text-sm border border-sia-gold/20 font-semibold">${leg.guestChef.header}: ${leg.guestChef.message}</div>`);
            }

            // Meals
            if (hasMeals) {
                const meals = leg.menu.language.EN_UK.meals;
                
                // Build Tabs (Centered)
                let mealTabsHtml = '<div class="flex justify-center gap-6 border-b border-black/10 dark:border-white/10 overflow-x-auto scrollbar-hide py-2 mt-4">';
                meals.forEach((meal, idx) => {
                    mealTabsHtml += `<button onclick="switchMealTab('${idx}', this)" class="meal-tab-btn whitespace-nowrap pb-2 text-sm font-bold ${idx === 0 ? 'text-sia-gold border-b-2 border-sia-gold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'} transition-colors">${meal.mealServiceName}</button>`;
                });
                mealTabsHtml += '</div>';
                mealsWrap.insertAdjacentHTML('beforeend', mealTabsHtml);
                
                meals.forEach((meal, idx) => {
                    const mealDiv = document.createElement('div');
                    mealDiv.className = `meal-tab-content space-y-4 ${idx === 0 ? '' : 'hidden'}`;
                    mealDiv.id = `meal-content-${idx}`;
                    
                    if (meal.selectionDetails && meal.selectionDetails.length > 0) {
                        meal.selectionDetails.forEach((selection, selIdx) => {
                            const selDiv = document.createElement('div');
                            // If culinary dropdown exists, hide non-matching culinary choices
                            selDiv.className = `bg-white/30 dark:bg-black/30 rounded-xl p-4 border border-black/5 dark:border-white/5 space-y-4 culinary-section-${selIdx} ${selIdx === 0 ? '' : 'hidden'}`;
                            
                            if (meal.selectionDetails.length > 1) {
                                selDiv.innerHTML += `<div class="font-bold text-sia-gold mb-2 text-center hidden">${selection.name}</div>`;
                            }
                            
                            if (selection.mealCourses) {
                                selection.mealCourses.forEach(course => {
                                    let courseHtml = `<div class="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-2">${course.category} ${course.maxSequence > 1 ? `(Choose ${course.maxSequence})` : ''}</div>`;
                                    
                                    if (course.items) {
                                        course.items.forEach(item => {
                                            let iconsHtml = '';
                                            if (item.icons && item.icons.length > 0) {
                                                item.icons.forEach(icon => {
                                                    if (icon === 'VGT') iconsHtml += `<span class="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-[10px] font-bold">V</span>`;
                                                    if (icon === 'WLSGD') iconsHtml += `<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 text-[10px] font-bold">Wellness</span>`;
                                                    if (icon === 'ICP') iconsHtml += `<span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 text-[10px] font-bold">Chef</span>`;
                                                });
                                            }
                                            let imgHtml = '';
                                            if (item.imagePathIfeHigh) {
                                                const imgUrl = item.imagePathIfeHigh.startsWith('http') ? item.imagePathIfeHigh : 'https://inflightmenu.singaporeair.com/' + item.imagePathIfeHigh;
                                                imgHtml = `<img src="${imgUrl}" class="w-16 h-16 object-cover rounded-lg bg-black/10 shrink-0" alt="${item.name}" loading="lazy">`;
                                            }
                                            courseHtml += `
                                                <div class="flex gap-3 mb-3 last:mb-0">
                                                    ${imgHtml}
                                                    <div>
                                                        <div class="font-semibold text-sm leading-tight flex flex-wrap gap-2 items-center">${item.name} ${iconsHtml}</div>
                                                        ${item.description ? `<div class="text-xs text-gray-500 mt-1">${item.description}</div>` : ''}
                                                    </div>
                                                </div>
                                            `;
                                        });
                                    }
                                    selDiv.innerHTML += `<div class="mb-4 last:mb-0">${courseHtml}</div>`;
                                });
                            }
                            mealDiv.appendChild(selDiv);
                        });
                    }
                    mealsWrap.appendChild(mealDiv);
                });
            }

            // Drinks
            if (hasDrinks) {
                const bevCats = leg.beverage.language.EN_UK.categories;
                bevCats.forEach(cat => {
                    const catDiv = document.createElement('details');
                    catDiv.className = 'group bg-white/30 dark:bg-black/30 rounded-xl border border-black/5 dark:border-white/5 mt-3';
                    catDiv.innerHTML = `
                        <summary class="flex justify-between items-center font-bold cursor-pointer p-4 select-none">
                            ${cat.name}
                            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform group-open:rotate-180"></i>
                        </summary>
                        <div class="px-4 pb-4 space-y-4 pt-1 border-t border-black/5 dark:border-white/5 group-open:block hidden">
                    `;
                    
                    let contentHtml = '';
                    if (cat.subcategories) {
                        cat.subcategories.forEach(sub => {
                            if (sub.name) {
                                contentHtml += `<div class="text-sm font-semibold text-sia-gold mb-2 mt-3 first:mt-0">${sub.name}</div>`;
                            }
                            if (sub.specialities) {
                                sub.specialities.forEach(spec => {
                                    if (spec.items) {
                                        spec.items.forEach(item => {
                                            contentHtml += `
                                                <div class="mb-2 last:mb-0">
                                                    <div class="text-sm font-semibold">${item.name}</div>
                                                    ${item.description ? `<div class="text-xs text-gray-500">${item.description}</div>` : ''}
                                                </div>
                                            `;
                                        });
                                    }
                                });
                            }
                        });
                    }
                    catDiv.innerHTML += contentHtml + `</div>`;
                    drinksWrap.appendChild(catDiv);
                });
            }

            // Snacks
            if (hasSnacks) {
                const subs = leg.drySnack.category.subcategories;
                const snackWrapper = document.createElement('div');
                snackWrapper.className = 'bg-white/30 dark:bg-black/30 rounded-xl p-4 border border-black/5 dark:border-white/5 space-y-4 mt-3';
                
                if (leg.drySnack.header) {
                    snackWrapper.innerHTML += `<p class="text-xs text-gray-500 italic mb-3">${leg.drySnack.header}</p>`;
                }
                
                subs.forEach(sub => {
                    if (sub.items && sub.items.length > 0) {
                        let html = `<div class="text-sm font-semibold text-sia-gold mb-2">${sub.name}</div>`;
                        sub.items.forEach(item => {
                            html += `
                                <div class="mb-2 last:mb-0 text-sm">
                                    ${item.name}
                                    ${item.description ? `<span class="text-xs text-gray-500"> — ${item.description}</span>` : ''}
                                </div>
                            `;
                        });
                        snackWrapper.innerHTML += `<div class="mb-4 last:mb-0">${html}</div>`;
                    }
                });
                snacksWrap.appendChild(snackWrapper);
            }

            // Amenities
            if (hasAmenities) {
                const amWrapper = document.createElement('div');
                amWrapper.className = 'bg-white/30 dark:bg-black/30 rounded-xl p-4 border border-black/5 dark:border-white/5 space-y-3 mt-3';
                
                leg.amenities.items.forEach(item => {
                    let imgHtml = '';
                    if (item.imagePath) {
                        const imgUrl = item.imagePath.startsWith('http') ? item.imagePath : 'https://inflightmenu.singaporeair.com/' + item.imagePath;
                        imgHtml = `<img src="${imgUrl}" class="w-12 h-12 object-contain rounded-lg shrink-0" alt="${item.itemName}" loading="lazy">`;
                    }
                    amWrapper.innerHTML += `
                        <div class="flex gap-3 items-center">
                            ${imgHtml}
                            <div>
                                <div class="text-sm font-semibold">${item.itemName}</div>
                                ${item.itemDescription ? `<div class="text-xs text-gray-500">${item.itemDescription}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                amWrap.appendChild(amWrapper);
            }
            
            lucide.createIcons();
        }
        
        function switchMenuCategory(cat, btnElement) {
            document.querySelectorAll('.menu-cat-pill').forEach(btn => {
                btn.classList.remove('bg-sia-gold', 'text-black', 'border-sia-gold');
                btn.classList.add('bg-black/5', 'dark:bg-white/5', 'border-black/10', 'dark:border-white/10');
            });
            btnElement.classList.remove('bg-black/5', 'dark:bg-white/5', 'border-black/10', 'dark:border-white/10');
            btnElement.classList.add('bg-sia-gold', 'text-black', 'border-sia-gold');
            
            document.querySelectorAll('.menu-cat-section').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('menu-cat-' + cat);
            if(target) target.classList.remove('hidden');
        }
        
        function switchMealTab(idx, btnElement) {
            document.querySelectorAll('.meal-tab-btn').forEach(btn => {
                btn.classList.remove('text-sia-gold', 'border-b-2', 'border-sia-gold');
                btn.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:hover:text-gray-300');
            });
            btnElement.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:hover:text-gray-300');
            btnElement.classList.add('text-sia-gold', 'border-b-2', 'border-sia-gold');
            
            document.querySelectorAll('.meal-tab-content').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('meal-content-' + idx);
            if(target) target.classList.remove('hidden');
        }

        function switchCulinarySelection(selIdx) {
            // Hide all culinary sections across all meals
            document.querySelectorAll('[class*="culinary-section-"]').forEach(el => el.classList.add('hidden'));
            // Show only the selected one
            document.querySelectorAll('.culinary-section-' + selIdx).forEach(el => el.classList.remove('hidden'));
        }
        
    </script>
</body>
</html>