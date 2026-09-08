const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const startIdx = html.indexOf('<!-- Preferences -->');
const endIdx = html.indexOf('<!-- Developer Section -->');

if (startIdx !== -1 && endIdx !== -1) {
    const newStr = `<!-- Feedback and Support -->
                <div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 px-1">Feedback and Support</p>
                    <div class="glass-panel rounded-2xl p-4 flex items-center justify-between shadow-sm border dark:border-white/5">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold">Chat with the developer</span>
                        </div>
                        <a href="https://t.me/harlequinzxc" target="_blank" class="px-5 py-1.5 rounded-full text-xs font-bold border border-sia-gold text-sia-gold hover:bg-sia-gold/10 transition-colors flex items-center gap-1.5 shrink-0">
                            <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Telegram
                        </a>
                    </div>
                </div>

                `;
    
    html = html.substring(0, startIdx) + newStr + html.substring(endIdx);
    fs.writeFileSync('index.html', html);
    console.log("Settings replaced.");
} else {
    console.log("Index not found.");
}
