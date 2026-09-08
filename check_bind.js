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
            // IFA Binding
            if (mode === 'ifa' || mode === 'both') {
                const typeSel = document.getElementById(`${id}-flight-type`);
                const cntSel = document.getElementById(`${id}-sector-count`);
                
                const renderIfaSectors = () => {
                    const container = document.getElementById(`${id}-ifa-sectors`);
                    const count = parseInt(cntSel.value);
                    const isTurn = typeSel.value === 'Turnaround';
                    const is4 = count === 4;

                    // Visibility logic per 4.2
                    const showUS = !isTurn && !is4;
                    const showPax = !is4;

                    let html = '';
                    for (let i = 1; i <= count; i++) {
                        let label = i % 2 !== 0 ? 'Outbound from SG' : 'Inbound to SG';
                        if (is4 && !isTurn && i > 1) label = 'Station to Station';
                        if (is4 && !isTurn && i === 4) label = 'Inbound to SG';

                        html += `
                            <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">Sector ${i} (${label})</p>
                                <input type="text" id="${id}-ifa-t${i}" class="ui-input w-full rounded-lg py-2 px-3 text-sm font-bold placeholder-gray-400 border border-transparent dark:border-white/10 outline-none ifa-time-input" placeholder="Flight Time (HH:MM)">
                                
                                <div class="flex gap-4 mt-2 ${!showUS && !showPax ? 'hidden' : ''}">
                                    ${showUS ? `<label class="flex items-center gap-1.5 text-xs font-bold text-gray-500 cursor-pointer"><input type="checkbox" id="${id}-ifa-us${i}" class="accent-sia-gold"> Direct US</label>` : ''}
                                    ${showPax ? `<label class="flex items-center gap-1.5 text-xs font-bold text-gray-500 cursor-pointer"><input type="checkbox" id="${id}-ifa-px${i}" class="accent-sia-gold"> Paxing</label>` : ''}
                                </div>
                            </div>
                        `;
                    }
                    container.innerHTML = html;
                    bindTimeInputs(id);

                    // Hide LMA if Turnaround
                    if (mode === 'both') {
                        const lmaWrap = document.getElementById(`${id}-lma-wrap`);
                        if (isTurn) {
                            lmaWrap.classList.add('hidden');
                        } else {
                            lmaWrap.classList.remove('hidden');
                        }
                    }
                };

                typeSel.addEventListener('change', renderIfaSectors);
                cntSel.addEventListener('change', renderIfaSectors);
                renderIfaSectors();
            }

            // LMA Binding
            if (mode === 'lma' || mode === 'both') {
                const container = document.getElementById(`${id}-lma-sectors`);
                const btnAdd = document.getElementById(`${id}-btn-add-lma`);
                let lmaCount = 0;

                const addLmaSector = () => {
                    lmaCount++;
                    const idx = lmaCount;
                    const div = document.createElement('div');
                    div.className = 'p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 relative overflow-hidden transition-all duration-500 max-h-0 opacity-0 scale-95';
                    
                    const today = new Date().toISOString().split('T')[0];
                    let defaultArr = today;
                    let defaultDep = today;

                    if (idx > 1) {
                        // Cascading logic fallback (initial)
                        const prevDep = document.getElementById(`${id}-lma-d${idx-1}`).value;
                        if (prevDep) {
                            const d = new Date(prevDep);
                            d.setDate(d.getDate() + 1);
                            defaultArr = d.toISOString().split('T')[0];
                            d.setDate(d.getDate() + 1);
                            defaultDep = d.toISOString().split('T')[0];
                        }
                    } else {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        defaultDep = d.toISOString().split('T')[0];
                    }

                    div.innerHTML = `
                        ${idx > 1 ? `<button type="button" class="absolute top-2 right-2 text-red-500 hover:text-red-700 lma-remove-btn" data-idx="${idx}"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
                        <div class="mb-3">
                            <label class="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Station IATA</label>
                            <div class="relative">
                                <input type="text" id="${id}-lma-iata${idx}" class="ui-input w-full rounded-lg py-2 px-3 pr-8 text-sm font-bold uppercase border border-transparent dark:border-white/10 outline-none lma-iata-input" placeholder="e.g. LHR" maxlength="3">
                                <i data-lucide="check" class="w-4 h-4 text-green-500 absolute right-3 top-2.5 hidden" id="${id}-lma-iata-check${idx}"></i>
                            </div>
                            <div id="${id}-lma-iata-info${idx}" class="text-[10px] font-bold mt-1 empty:hidden"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Arrival Date</label>
                                <input type="date" id="${id}-lma-a${idx}" value="${defaultArr}" class="ui-input w-full rounded-lg py-2 px-3 text-xs font-bold focus:border-sia-gold outline-none date-cascade" data-idx="${idx}">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Time</label>
                                <input type="text" id="${id}-lma-at${idx}" class="ui-input w-full rounded-lg py-2 px-3 text-xs font-bold border border-transparent dark:border-white/10 outline-none lma-time-input" placeholder="HH:MM">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Dep Date</label>
                                <input type="date" id="${id}-lma-d${idx}" value="${defaultDep}" class="ui-input w-full rounded-lg py-2 px-3 text-xs font-bold focus:border-sia-gold outline-none date-cascade-dep" data-idx="${idx}">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Time</label>
                                <input type="text" id="${id}-lma-dt${idx}" class="ui-input w-full rounded-lg py-2 px-3 text-xs font-bold border border-transparent dark:border-white/10 outline-none lma-time-input" placeholder="HH:MM">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                    lucide.createIcons();
                    setTimeout(() => {
                        div.classList.remove('max-h-0', 'opacity-0', 'scale-95');
                        div.classList.add('max-h-[500px]', 'opacity-100', 'scale-100');
                        if (appPrefs.autoScroll) setTimeout(() => scrollToBottom(), 300);
                    }, 10);
                    bindTimeInputs(id);
                    
                    if (idx === 3) btnAdd.classList.add('hidden'); // max 3
                };

                addLmaSector(); // Default 1st station

                btnAdd.addEventListener('click', addLmaSector);

                // Event delegation for cascading dates
                container.addEventListener('change', (e) => {
                    if (e.target.classList.contains('date-cascade')) {
                        const idx = parseInt(e.target.dataset.idx);
                        const val = e.target.value;
                        if (!val) return;
                        
                        let d = new Date(val + "T00:00:00");
                        d.setDate(d.getDate() + 1);
                        
                        const dep = document.getElementById(`${id}-lma-d${idx}`);
                        if (dep) dep.value = d.toISOString().split('T')[0];

                        // Cascade forward if exists
                        for (let j = idx + 1; j <= lmaCount; j++) {
                            const arrNext = document.getElementById(`${id}-lma-a${j}`);
                            const depNext = document.getElementById(`${id}-lma-d${j}`);
                            if (arrNext && depNext) {
                                d.setDate(d.getDate() + 1);
                                arrNext.value = d.toISOString().split('T')[0];
                                d.setDate(d.getDate() + 1);
                                depNext.value = d.toISOString().split('T')[0];
                            }
                        }
                    }
                });

                container.addEventListener('click', (e) => {
                    const btn = e.target.closest('.lma-remove-btn');
                    if (btn) {
                        const block = btn.parentElement;
                        block.classList.remove('max-h-[500px]', 'opacity-100', 'scale-100');
                        block.classList.add('max-h-0', 'opacity-0', 'scale-95');
                        setTimeout(() => block.remove(), 500);
                        lmaCount--;
                        btnAdd.classList.remove('hidden');
                    }
                });
            }

            document.getElementById(`${id}-btn-calc`).addEventListener('click', () => {
                executeCalculation(id, mode);
            });
        }
