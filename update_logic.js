const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldFunc = /async function executeFetchCabins\(id, flightNumber, dateStr, mode\) \{[\s\S]*?async function submitFlightVerification\(id, actionType\) \{/;

const newFunc = `async function executeFetchCabins(id, flightNumber, dateStr, mode) {
            const actionArea = document.getElementById(\\\`fv-action-area-\${id}\\\`);
            const loading = document.getElementById(\\\`fv-loading-\${id}\\\`);
            
            try {
                const payloadCabin = {
                    carrierId: "SQ",
                    flightNumber: flightNumber,
                    flightDate: dateStr,
                    sessionId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                };

                const res = await fetch('/api/sq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: 'getcabin', payload: payloadCabin })
                });
                
                let data;
                try {
                    data = await res.json();
                } catch(e) {
                    throw new Error("Vercel Edge Proxy failed to return JSON.");
                }
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (data.statusCode === 101) {
                    loading.classList.add('hidden');
                    actionArea.innerHTML = '<div class="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Menus not published for this flight/date yet.</div>';
                    actionArea.classList.remove('hidden');
                    lucide.createIcons();
                    return;
                }
                else if (data.statusCode === 200 && data.cabinClasses && data.cabinClasses.length > 0) {
                    
                    // We need to fetch the menu for the first cabin to determine sectors
                    const firstCabin = data.cabinClasses[0];
                    const payloadMenu = {
                        ...payloadCabin,
                        cabinClass: firstCabin
                    };
                    
                    const resMenu = await fetch('/api/sq', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endpoint: 'menu', payload: payloadMenu })
                    });
                    
                    let menuData;
                    try {
                        menuData = await resMenu.json();
                    } catch(e) {
                        throw new Error("Vercel Edge Proxy failed to return JSON for menu.");
                    }
                    
                    loading.classList.add('hidden');
                    
                    currentMenuSearch.flightNumber = flightNumber;
                    currentMenuSearch.date = dateStr;
                    currentMenuSearch.cabins = data.cabinClasses;
                    
                    const legs = menuData.legs || [];
                    const isMultiSector = legs.length > 1;
                    
                    let contentHtml = '';
                    
                    // 1. Sectors
                    if (isMultiSector) {
                        contentHtml += \\\`
                            <div id="fv-sectors-section-\${id}">
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Sectors</label>
                                <div class="flex flex-wrap gap-2 mb-4" id="fv-sectors-container-\${id}">
                        \\\`;
                        legs.forEach(leg => {
                            const code = leg.flightDetails.departureAirportCode + '-' + leg.flightDetails.arrivalAirportCode;
                            const label = leg.flightDetails.departureAirportCode + ' ✈ ' + leg.flightDetails.arrivalAirportCode;
                            contentHtml += \\\`
                                <button type="button" onclick="toggleSector('\${id}', this)" data-sector="\${code}" class="border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">\${label}</button>
                            \\\`;
                        });
                        contentHtml += \\\`
                                </div>
                            </div>
                        \\\`;
                    }
                    
                    // 2. Cabins
                    contentHtml += \\\`
                        <div id="fv-cabins-section-\${id}" class="\${isMultiSector ? 'hidden' : ''}">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Cabins (\${dateStr})</label>
                            <div class="flex flex-wrap gap-2 mb-4" id="fv-cabins-container-\${id}">
                    \\\`;
                    
                    const cabinNames = {
                        'FCL': 'First/Suites',
                        'JCL': 'Business',
                        'SCL': 'Premium Eco',
                        'YCL': 'Economy'
                    };
                    
                    data.cabinClasses.forEach(code => {
                        contentHtml += \\\`
                            <button type="button" onclick="this.classList.toggle('selected-cabin'); this.classList.toggle('bg-sia-gold'); this.classList.toggle('text-black'); this.classList.toggle('border-sia-gold'); checkCabinsSelected('\${id}');" data-cabin="\${code}" class="border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">\${cabinNames[code] || code}</button>
                        \\\`;
                    });
                    contentHtml += \\\`
                            </div>
                        </div>
                    \\\`;
                    
                    // 3. Actions
                    contentHtml += \\\`
                        <div class="flex gap-2 \${isMultiSector ? 'hidden' : 'opacity-50 pointer-events-none'}" id="fv-actions-section-\${id}">
                            \${mode === 'menu' ? \\\`<button onclick="submitFlightVerification('\${id}', 'menu')" class="flex-1 bg-sia-navy dark:bg-sia-gold dark:text-black text-white font-bold rounded-xl py-2.5 shadow-sm flex justify-center items-center gap-2 transition-transform active:scale-95 text-xs">
                                <i data-lucide="book-open" class="w-4 h-4"></i> Menu
                            </button>\\\` : ''}
                            <button onclick="submitFlightVerification('\${id}', 'print')" class="flex-1 \${mode === 'print' ? 'bg-sia-navy dark:bg-sia-gold dark:text-black text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10'} font-bold rounded-xl py-2.5 shadow-sm transition-transform active:scale-95 text-xs flex justify-center items-center gap-2">
                                <i data-lucide="printer" class="w-4 h-4"></i> Print
                            </button>
                        </div>
                    \\\`;
                    
                    actionArea.innerHTML = contentHtml;
                    
                    // Save sectors in dataset for single-sector flights
                    if (!isMultiSector && legs.length === 1) {
                        actionArea.dataset.singleSector = legs[0].flightDetails.departureAirportCode + '-' + legs[0].flightDetails.arrivalAirportCode;
                    }
                    
                    actionArea.classList.remove('hidden');
                    lucide.createIcons();
                    scrollToBottom();
                } else {
                    loading.classList.add('hidden');
                    actionArea.innerHTML = '<div class="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Unexpected response from SQ system.</div>';
                    actionArea.classList.remove('hidden');
                }
            } catch (err) {
                loading.classList.add('hidden');
                actionArea.innerHTML = '<div class="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Fetch crashed: ' + String(err.message || err) + '</div>';
                if (err.message === 'UPSTREAM_TIMEOUT') {
                    actionArea.innerHTML = '<div class="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Request timed out.</div>';
                } else {
                    actionArea.innerHTML = '<div class="text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Network error connecting to SQ system.</div>';
                }
                actionArea.classList.remove('hidden');
            }
        }
        
        function toggleSector(id, btn) {
            btn.classList.toggle('selected-sector');
            btn.classList.toggle('bg-sia-gold');
            btn.classList.toggle('text-black');
            btn.classList.toggle('border-sia-gold');
            
            const container = document.getElementById(\\\`fv-sectors-container-\${id}\\\`);
            const selected = container.querySelectorAll('.selected-sector');
            const cabinSec = document.getElementById(\\\`fv-cabins-section-\${id}\\\`);
            
            if (selected.length > 0) {
                cabinSec.classList.remove('hidden');
            } else {
                cabinSec.classList.add('hidden');
                document.getElementById(\\\`fv-actions-section-\${id}\\\`).classList.add('hidden');
                // Deselect all cabins if sectors are 0
                document.querySelectorAll(\\\`#fv-cabins-container-\${id} .selected-cabin\\\`).forEach(c => {
                    c.classList.remove('selected-cabin', 'bg-sia-gold', 'text-black', 'border-sia-gold');
                });
            }
            checkCabinsSelected(id);
        }
        
        function checkCabinsSelected(id) {
            const cabinContainer = document.getElementById(\\\`fv-cabins-container-\${id}\\\`);
            const selected = cabinContainer.querySelectorAll('.selected-cabin');
            const actions = document.getElementById(\\\`fv-actions-section-\${id}\\\`);
            
            if (selected.length > 0) {
                actions.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
            } else {
                actions.classList.add('opacity-50', 'pointer-events-none');
            }
        }

        async function submitFlightVerification(id, actionType) {`;

html = html.replace(oldFunc, newFunc.replace(/\\`/g, '`').replace(/\\\$/g, '$'));

fs.writeFileSync('index.html', html);
