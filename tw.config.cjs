// hotfix 18: the app ships a COMPILED Tailwind stylesheet and never runs the
// Play CDN JIT in the browser (a runtime compiler with a MutationObserver
// recompiled on every DOM change — mid-gesture on a 120Hz foldable that meant
// style invalidation storms and black flashes). Rebuild after editing class
// names in index.html:
//   /home/user/smoke/node_modules/.bin/tailwindcss -c tw.config.cjs -o tw.css --minify
//   cp tw.css /home/user/smoke/tw.css
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { sia: { gold: '#C9A227', goldlt: '#E8C766', navy: '#0B1A3A', deep: '#04070F', batik: '#5B3E96' } },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'], mono: ['"Space Mono"', 'monospace'] },
    },
  },
  corePlugins: { preflight: true },
};
