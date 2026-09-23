# Feature Tour — Full Breakdown (v1.23.9)

Every beat from the first chat message to the last, with exact machine timings, numbered for reference. Quote the number (e.g. "2.14") when telling me what to modify, add or remove.

**How to read the timings**
- `[wait Ns]` = a fixed machine pause the tour takes on its own.
- `[USER]` = the tour stops dead until you tap a button (Next / Skip tour / Finish). No timeout.
- `[typing]` = every chat bubble arrives the way a real message does: typing dots show for **~0.6–0.9s**, the bubble renders, then a **0.8s settle** before the queue moves on. This rides on *every* bot message and every button-bubble automatically — it is not a separate step, but it's why back-to-back messages never feel instant.
- Typing into a field = **one keystroke every 0.45s**.

---

## Universal rules (apply throughout)

| # | Rule |
|---|---|
| A1 | While the tour runs: user scrolling is fully blocked (wheel + touch, everywhere — chat, sheets, chips). |
| A2 | While the tour runs: **Settings**, **clear-chat (↻)** and the **quick action chip row** ignore taps and horizontal scroll. Released the moment the tour ends. |
| A3 | Gold pulsing ring (glow) marks the current target. It scrolls the target into view first (cards top-align; deep fields center via smooth scroll). |
| A4 | Typing anything mid-tour (except during the finale) pauses the tour: your question gets answered, then "Of course — the tour can wait. Pick up where we left off?" with **Resume / Skip tour**. Resume restarts the *same step* from its beginning. |
| A5 | Every step ends with a **Next / Skip tour** button pair — except the finale, which offers a single **Finish** button. The moment either is pressed, the pair retires: dimmed and inert, never left looking pressable. |
| A6 | Skip at any point → cleanup, "No problem — type **tour** whenever you want it." |
| A7 | All demo data is sandboxed — nothing you own is touched; the calculator mode is restored afterwards. |
| A8 | The demo roster is fixed: SQ442/441 KTM layover, SQ740/739 Phuket turnaround, SQ 134/133/138/137 Penang shuttle — "July 2026 - Demo.pdf", 3 trips · 8 sectors, month total **$823.23**; the manual demo computes **$360.72**. |

---

## Phase 0 — Before the tour (first run only)

| # | Beat | Timing |
|---|---|---|
| 0.1 | App opens. If a **what's-new sheet** is due, it opens alone — the welcome chat is held until you close it (×). | sheet waits for you |
| 0.2 | Welcome: *"Good morning/afternoon/evening, {rank} {name}!"* | [typing] |
| 0.3 | *"How can I help you today?"* | [typing] |
| 0.4 | ~1.2s after the greeting settles, the offer: *"Before we start, allow me to show you around."* | [typing] |
| 0.5 | *"Two minutes of your time, that is all I ask for."* + **LET'S GO** / **NOT NOW** buttons | [typing], then [USER] |
| 0.6 | NOT NOW → *"No worries — type **tour** whenever you want it."* (tour can be started any time by typing `tour` or `help`) | — |
| 0.7 | LET'S GO → tour begins at Step 1. (If you started it by typing `tour` later, Phase 0 never happened.) | — |

---

## Step 1 — Chat basics

| # | Beat | Timing |
|---|---|---|
| 1.1 | *"I am your personal assistant, ask me anything related to your flight in the chat box."* | [typing] |
| 1.2 | *“How much is my allowance?”* (italic, quoted example) | [typing] |
| 1.3 | *“What are we serving onboard?”* (italic, quoted example) | [typing] |
| 1.4 | *"Or tap on a quick action chip below."* | [typing] |
| 1.5 | Glow the **chat input bar** | [wait 2.2s] |
| 1.6 | Glow the **first quick action chip** | [wait 2.0s] |
| 1.7 | **Next / Skip tour** | [USER] |

---

## Step 2 — Roster showpiece (paperclip → demo month → save → earnings)

### 2A. The paperclip
| # | Beat | Timing |
|---|---|---|
| 2.1 | *"See that paperclip down there?"* | [typing] |
| 2.2 | Glow the **paperclip** | [wait 1.8s] |
| 2.3 | Unglow | instant |
| 2.4 | *"Attach your downloaded **roster report/s** from **Crew App** and allow me to calculate your month/s allowance."* | [typing] |
| 2.5 | **Next / Skip tour** | [USER] |

### 2B. The fictitious roster
| # | Beat | Timing |
|---|---|---|
| 2.6 | *"In this demo, I will attach a fictitious roster — with three different flights: **SQ442/441** a Kathmandu layover, **SQ740/739** a Phuket turnaround, and **SQ 134/133/138/137** a four sector Penang shuttle."* | [typing] |
| 2.7 | **Next / Skip tour** | [USER] |
| 2.8 | The demo "attaches": **roster confirm card** renders — "July 2026 - Demo.pdf — Jul 2026: 3 trips · 8 sectors", the three trips listed, **[Build cards] [Discard]** (secondary) and **[Calculate all]** (primary gold) | [typing] |

### 2C. Build vs Calculate
| # | Beat | Timing |
|---|---|---|
| 2.9 | *"Press **Build cards** to tweak your flight details (if any) or press **Calculate all** and let me compute your total allowance."* | [typing] |
| 2.10 | **Next / Skip tour** | [USER] |
| 2.11 | *"Once the calculations are complete after tapping **Calculate All**, a summary page will open — tap the **save** icon on the top right to archive your earnings."* | [typing] |
| 2.12 | **Next / Skip tour** | [USER] |

### 2D. The summary page (only after 2.12)
| # | Beat | Timing |
|---|---|---|
| 2.13 | Nothing is highlighted. Demo presses **Calculate all** | [wait 0.6s] then tap |
| 2.14 | Real app line: *"Building 3 cards and calculating every flight — results in a moment."* (3 cards build; offline they compute from the roster itself) | [typing] |
| 2.15 | Combined **summary page** opens (month total **$823.23**) | — |
| 2.16 | Hold on the fresh page | [wait 2.05s] |
| 2.17 | **Slow smooth scroll** top → bottom of the whole page (40 hops) | 8.0s |
| 2.18 | Pause at the bottom | [wait 1.2s] |
| 2.19 | Glow the **save icon** (top-right) | [wait 2.0s] |
| 2.20 | Unglow, then tap **save** | [wait 1.2s inside glow] |
| 2.21 | "Save to archives?" **confirm window** opens; held for a read | [wait 2.0s] |
| 2.22 | Confirm (**OK**) → entry filed | [wait 1.8s] |
| 2.23 | *"<b>Saved.</b> July 2026 is filed under your earnings."* | [typing] |
| 2.24 | Pause | [wait 0.5s] |
| 2.25 | Close the summary window | — |
| 2.26 | Pause | [wait 1.2s] |

### 2E. The earnings chapter
| # | Beat | Timing |
|---|---|---|
| 2.27 | *"Tap on the **"How much have I earned?"** quick action chip to view your archived earning/s."* | [typing] |
| 2.28 | Glow the **How much have I earned? chip** | [wait 2.0s] |
| 2.29 | Unglow | instant |
| 2.30 | *"Earnings are grouped by months. Tap on any flight and its whole summary reopens."* | [typing] |
| 2.31 | **Next / Skip tour** (the earnings page opens *only* after this) | [USER] |
| 2.32 | Demo taps the chip → **earnings page** opens (3 flights grouped under Jul 2026, $823.23) | [wait 1.0s] + tap, [wait 2.0s] |
| 2.33 | Glow a **flight row** | [wait 1.5s] |
| 2.34 | Tap the row → its full summary reopens | [wait 2.0s] |
| 2.35 | Close the flight summary | [wait 2.0s] |
| 2.36 | Close the earnings page | [wait 1.0s] |
| 2.37 | **Next / Skip tour** (step end) | [USER] |

---

## Step 3 — Default mode (typed out, fetch, calculate)

| # | Beat | Timing |
|---|---|---|
| 3.1 | *"Now there are two ways of calculating allowances. In **Default** mode — just enter your flight number and date, and I will fetch the rest."* | [typing] |
| 3.2 | *"Watch: the chip, the card, then Fetch — **SQ 632** out and **SQ 633** home, the day after."* | [typing] |
| 3.3 | Hold after the message | [wait 2.5s] |
| 3.4 | Glow the **Calculate my allowance chip** | [wait 2.4s] |
| 3.5 | Demo taps it → your *"Calculate my allowance."* bubble + the **COP Allowance Calculator card** renders, scrolled to its **header at the top**; sector 1 & 2 flight numbers verified empty | — |
| 3.6 | Glow **sector 1 flight number** | [wait 1.2s] |
| 3.7 | Type **632** — `6` · `3` · `2` | 3 × 0.45s |
| 3.8 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 3.9 | Glow **sector 2 flight number** | [wait 1.2s] |
| 3.10 | Type **633** — `6` · `3` · `3` | 3 × 0.45s |
| 3.11 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 3.12 | Dates set silently (sector 1 = today+2, sector 2 = the day after) | [wait 0.6s] |
| 3.13 | Glow the **Fetch all** button | — |
| 3.14 | *"Fetch all — only works for flights from two days ago to six weeks out."* | [typing] |
| 3.15 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 3.16 | **Slow scroll** to the **Fetch all button** (centered in the view) | ~0.8s |
| 3.17 | Demo presses **Fetch all** → sectors fetch; **online** both fill in and turn green; **offline** the honest pivot: *"No connection just now — that's the honest answer, never a made-up number. Online, Fetch fills it all in; offline, the manual way — next step — always works."* → jump to 3.23 | — |
| 3.18 | *(online)* Pause on the green sectors | [wait 1.2s] |
| 3.19 | Glow the **Calculate** button | [wait 1.2s] |
| 3.20 | Demo presses it → **summary opens**, and the app itself posts *"Your total COP Allowance is $…"* in chat | [wait 2.0s] |
| 3.21 | *"Similarly you may tap the **save** icon to archive your earnings."* (no save demo) | [typing] |
| 3.22 | Pause, close the summary | [wait 1.2s], [wait 0.9s] |
| 3.23 | **Next / Skip tour** (step end) | [USER] |

---

## Step 4 — Manual mode (everything by hand)

| # | Beat | Timing |
|---|---|---|
| 4.1 | *"Next is **Manual** mode — no fetching at all. You type the flight time, select the layover station IATA and the station's arrival and departure date and time yourself."* | [typing] |
| 4.2 | *"The switch lives in Settings. Let me change it from **Default** to **Manual**."* | [typing] |
| 4.3 | **Next / Skip tour** (lead gate — before anything moves) | [USER] |
| 4.4 | Glow the **Settings gear** | [wait 1.6s] |
| 4.5 | Open Settings, glow the **Manual pill** | [wait 0.8s], [wait 1.4s] |
| 4.6 | Switch to Manual, close Settings | [wait 0.8s], [wait 0.6s] |
| 4.7 | Glow the **Calculate my allowance chip** | [wait 1.4s] |
| 4.8 | Demo taps it (chip unlit right after), card renders scrolled to its header; flight times 1 & 2, station IATA, arrival and departure time all verified **empty** | — |
| 4.9 | Layover dates arrive pre-filled; the demo silently picks the overnight pairing (arrival today, departure tomorrow) | [wait 0.4s] |
| 4.10 | Glow **sector 1 Flight Time Duration** | [wait 1.2s] |
| 4.11 | Type **456** → auto-formats to **4:56** | 3 × 0.45s |
| 4.12 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 4.13 | Glow **sector 2 Flight Time Duration** | [wait 1.2s] |
| 4.14 | Type **515** → **5:15** | 3 × 0.45s |
| 4.15 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 4.16 | **Slow smooth scroll** down to the **Station IATA** box (centered) | ~0.8s |
| 4.17 | Glow it | [wait 1.2s] |
| 4.18 | Type **ktm** → uppercased, green check, "Kathmandu, Nepal" | 3 × 0.45s |
| 4.19 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 4.20 | **Slow scroll** to the **Arrival time** box, glow | ~0.8s, [wait 1.2s] |
| 4.21 | Type **2155** → **21:55** | 4 × 0.45s |
| 4.22 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 4.23 | **Slow scroll** to the **Departure time** box, glow | ~0.8s, [wait 1.2s] |
| 4.24 | Type **2259** → **22:59** | 4 × 0.45s |
| 4.25 | Pause, unglow, pause | [wait 0.9s] ×2 |
| 4.26 | **Slow scroll** to the **Calculate** button, glow | ~0.8s, [wait 1.2s] |
| 4.27 | Demo presses it → **summary opens** ($360.72) — no save icon demo | [wait 2.0s] |
| 4.28 | Close the summary | [wait 0.9s] |
| 4.29 | Mode silently reverted to Default | — |
| 4.30 | *"That's **Manual** mode — I have reverted everything back to **default**."* | [typing] |
| 4.31 | **Next / Skip tour** (step end) | [USER] |

---

## Step 5 — Finale (menu) + conclusion

| # | Beat | Timing |
|---|---|---|
| 5.1 | *"Last functionality — and the most straightforward of them all.."* | [typing] |
| 5.2 | *"Type **"menu"** in the chat bar or tap on the **"What's being served?"** quick action chip — key in flight number and a date and I'll pull the inflight menu onboard."* | [typing] |
| 5.3 | Glow the **chat input bar** | [wait 1.4s] |
| 5.4 | Glow the **What's being served? chip** | [wait 1.4s] |
| 5.5 | Glow the **chat input bar** again | [wait 1.4s] |
| 5.6 | Glow the **chip** again | [wait 1.4s] |
| 5.7 | Unglow, pause | [wait 0.9s] |
| 5.8 | *"With this, the feature tour has come to an end."* | [typing] |
| 5.9 | **Finish** — a single button, no skip at the door | [USER] |
| 5.10 | Tour concludes: all locks released, demo data discarded, mode restored | — |
| 5.11 | **The entire chat is cleared** | — |
| 5.12 | *"Thank you so much for your time. Type **"tour"** or **"help"** anytime if you would like me to run the feature tour again."* | [typing] |
| 5.13 | *"Is there anything I can assist you with?"* — clean slate, everything tappable/scrollable again | [typing] |

---

## Pocket reference

- **Gates where the tour waits for you:** 0.5 (offer), 1.7, 2.5, 2.7, 2.10, 2.12, 2.31, 2.37, 3.23, 4.3, 4.31, 5.9 — twelve in total (the finale's gate has only Finish).
- **Machine-paced time between gates** (typing dots + waits, no user time): roughly 10s in Step 1, ~62s across Step 2, ~48s in Step 3, ~76s in Step 4, ~17s in Step 5.
- **Code anchor:** tour module = 4th inline `<script>` in `index.html` (~lines 10630–11170); steps registry `CA_TOUR_STEPS`, pacing helpers `caTourWait`/`caTourTypeInto`/`caTourScrollHere`/`caTourGlowHere`/`caTourScrollResults`, gates `T.next(label, withSkip)` — pass `false` to omit the skip button — engine `caTourRun`.
