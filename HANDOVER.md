# AI Agent Handoff File (CrewAssist)

---

## 🟢 Current State (Completed & Working)
- **Step 1:** PWA scaffold, animated starry sky canvas, theme toggles, and gold paper-plane logo.
- **Step 2:** Onboarding UI, Settings Bottom Sheet, and Developer Mode (toggled via 10 taps on the logo).
- **Step 3:** Chatbot interface, initial greeting, quick action chips, and Regex intent parser.
- **Step 4:** COP / IFA / LMA Calculators with dynamic nested sectors, cascading dates, and a glassmorphic summary breakdown overlay.
- **Step 5:** Inflight Menu Viewer. Implemented dynamic flight verification in chat. Fetches JSON via `api/sq.js` Vercel Edge proxy. Renders a beautiful Hero Card, `relative` flow dropdowns (Cabin, Sector, Cuisine), Category Pills (Meals, Drinks, Snacks, Amenities), and conditional Meal Tabs (Lunch/Dinner). 
- **UI Tweaks:** All CTA buttons standardized (SIA Navy background, Gold text/border, pill-shaped, uppercase). Calculator button validation properly checks for empty fields before unlocking. The chat container aggressively and reliably auto-scrolls to the bottom upon new content. 

## 🔴 In-Progress / Known Bugs
- **The Onboarding Gender Bug:** In a previous UI tweak, the `toggle-autoscroll` checkbox was removed from the HTML Settings menu. However, the JavaScript in `initUI()` is still trying to access `document.getElementById('toggle-autoscroll').checked`. This throws a Null Reference Exception, which halts the rest of the JS execution and prevents the Gender select buttons on the Onboarding screen from functioning. 

## 🏗 Key Architecture Decisions & Constraints
- **DOM Injection:** DO NOT use `container.innerHTML += ...` for complex dynamic components (like the menu loops), as it causes async DOM reparsing that drops JS event references and produces `null` element errors on mobile. Always use `insertAdjacentHTML('beforeend', ...)` or `document.createElement`.
- **Vercel Proxy:** The SQ API Datacenter uses aggressive WAF blocking. `api/sq.js` MUST remain configured as an `edge` runtime using pure JSON proxying, as standard fetch calls fail.
- **Design System:** Respect the glassmorphic styling (`glass-bubble`, `glass-sheet`). Stick to the standard palette: SIA Navy (`#0b1a3a`), Charcoal, and SIA Gold (`#c9a227`).
- **Continuity** After every commit, update, README.md and HANDOVER.md file to reflect any updates.