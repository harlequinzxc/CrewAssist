const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetStr = `                <!-- Preferences -->
                <div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 px-1">Preferences</p>
                    <div class="glass-panel rounded-2xl p-4 flex items-center justify-between shadow-sm border dark:border-white/5">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold">Auto-scroll Chat</span>
                            <p class="text-[10px] text-gray-500 mt-1 flex items-center gap-1 font-medium">
                                <i data-lucide="arrow-down-to-line" class="w-3 h-3"></i> Jump to newest message
                            </p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="toggle-autoscroll" class="sr-only peer" checked>
                            <div class="w-9 h-5 bg-gray-300 dark:bg-[#04070F] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sia-gold"></div>
                        </label>
                    </div>
                </div>`;

const newStr = `                <!-- Feedback and Support -->
                <div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 px-1">Feedback and Support</p>
                    <div class="glass-panel rounded-2xl p-4 flex flex-col gap-3 shadow-sm border dark:border-white/5">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold">Chat with the developer</span>
                        </div>
                        <a href="https://t.me/harlequinzxc" target="_blank" class="w-full text-center py-2.5 rounded-full text-xs font-bold border border-sia-gold text-sia-gold hover:bg-sia-gold/10 transition-colors flex items-center justify-center gap-2">
                            <i data-lucide="message-square" class="w-4 h-4"></i> Contact on Telegram
                        </a>
                    </div>
                </div>`;

if(html.includes(targetStr)) {
    html = html.replace(targetStr, newStr);
    fs.writeFileSync('index.html', html);
    console.log("Settings replaced.");
} else {
    console.log("Not found.");
}
