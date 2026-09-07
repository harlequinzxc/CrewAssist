const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix dropdown absolute positioning to relative to push content down
html = html.replace(
    /class="absolute top-full left-0 w-full mt-1 bg-white dark:bg-\[\#0b1a3a\] border border-black\/10 dark:border-white\/10 rounded-xl overflow-hidden shadow-xl max-h-0 opacity-0 pointer-events-none transition-all duration-300 z-20"/g,
    'class="w-full mt-1 bg-white dark:bg-[#0b1a3a] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden max-h-0 opacity-0 pointer-events-none transition-all duration-500 z-20 relative"'
);

// 2. Fix bindTimeInputs Function
const bindTimeOldRegex = /function bindTimeInputs\([\s\S]*?\}\n        \}/;

const bindTimeNew = `function bindTimeInputs() {
            document.querySelectorAll('.ifa-time-input, .lma-time-input').forEach(input => {
                const newInp = input.cloneNode(true);
                input.parentNode.replaceChild(newInp, input);
                const isLma = newInp.classList.contains('lma-time-input');

                newInp.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\\D/g, '');
                    if (val.length > 4) val = val.slice(0, 4);

                    let formatted = val;
                    if (val.length === 3) {
                        formatted = val.slice(0, 1) + ':' + val.slice(1, 3);
                    } else if (val.length === 4) {
                        formatted = val.slice(0, 2) + ':' + val.slice(2, 4);
                    }

                    let isValid = false;
                    if (formatted.includes(':')) {
                        let [h, m] = formatted.split(':');
                        let hi = parseInt(h);
                        let mi = parseInt(m);
                        
                        if (isLma) {
                            if (hi > 23 || (hi === 23 && mi > 59) || hi >= 24) {
                                hi = 23; mi = 59;
                            } else if (mi > 59) mi = 59;
                            formatted = hi.toString() + ':' + mi.toString().padStart(2, '0');
                            isValid = true;
                        } else {
                            if (mi > 59) mi = 59;
                            formatted = hi.toString() + ':' + mi.toString().padStart(2, '0');
                            isValid = true;
                        }
                    }

                    e.target.value = formatted;
                    
                    if (isValid) {
                        e.target.classList.remove('border-transparent', 'border-red-500', 'dark:border-white/10');
                        e.target.classList.add('border-green-500', 'dark:border-green-500');
                    } else {
                        e.target.classList.remove('border-green-500', 'dark:border-green-500', 'border-red-500');
                        e.target.classList.add('border-transparent', 'dark:border-white/10');
                    }
                });
            });

            document.querySelectorAll('.lma-iata-input').forEach(input => {
                const newInp = input.cloneNode(true);
                input.parentNode.replaceChild(newInp, input);

                newInp.addEventListener('input', (e) => {
                    let val = e.target.value.trim().toUpperCase();
                    e.target.value = val;
                    
                    const container = e.target.closest('.relative');
                    const checkIcon = container.querySelector('.absolute.right-3');
                    const infoText = container.nextElementSibling;
                    
                    if (val.length === 3) {
                        const airport = airports.find(a => a.code === val);
                        if (airport) {
                            e.target.classList.remove('border-red-500', 'border-transparent', 'dark:border-white/10', 'dark:border-red-500');
                            e.target.classList.add('border-green-500', 'dark:border-green-500');
                            if (checkIcon) checkIcon.classList.remove('hidden');
                            if (infoText) infoText.innerHTML = '<span class="text-green-600 dark:text-green-400">' + airport.city + ', ' + airport.country + '</span>';
                        } else {
                            e.target.classList.remove('border-green-500', 'dark:border-green-500', 'border-transparent', 'dark:border-white/10');
                            e.target.classList.add('border-red-500', 'dark:border-red-500');
                            if (checkIcon) checkIcon.classList.add('hidden');
                            if (infoText) infoText.innerHTML = '<span class="text-red-500">Unknown Station</span>';
                        }
                    } else {
                        e.target.classList.remove('border-green-500', 'border-red-500', 'dark:border-green-500', 'dark:border-red-500');
                        e.target.classList.add('border-transparent', 'dark:border-white/10');
                        if (checkIcon) checkIcon.classList.add('hidden');
                        if (infoText) infoText.innerHTML = '';
                    }
                });
            });
        }`;

html = html.replace(bindTimeOldRegex, bindTimeNew);

fs.writeFileSync('index.html', html);
console.log("Done.");
