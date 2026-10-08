// hotfix 18: the app ships a COMPILED Tailwind stylesheet and never runs the
// Play CDN JIT in the browser (a runtime compiler with a MutationObserver
// recompiled on every DOM change — mid-gesture on a 120Hz foldable that meant
// style invalidation storms and black flashes). Rebuild after editing class
// names in index.html:
//   tests/smoke/node_modules/.bin/tailwindcss -c tw.config.cjs -o tw.css --minify
//   (tests/smoke/build-app.js copies it into the browser rig)
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  // v1.43.0 hotfix (owner order): hover variants compile behind
  // @media (hover:hover) — a finger tap latches :hover on touch, and an
  // ungated hover utility sticks as a false pressed state after release
  // (the same latch that washed out the gold tag toggle).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: { sia: { gold: '#C9A227', goldlt: '#E8C766', navy: '#0B1A3A', deep: '#04070F', batik: '#5B3E96' } },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'], mono: ['"Space Mono"', 'monospace'] },
    },
  },
  corePlugins: { preflight: true },
};
