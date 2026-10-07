# LOGIC.md — Calculation Engine & Business Rules Specification

> **Source of truth for formulas and rules.** Upstream authority: the **Singapore Airlines Staff Members' Agreement 2025 (CA No.058/2025)** — see *The official basis* below. Default coefficients (rank rates, buffers, brackets, LMA B/L/D) ship in `rates.json`; Developer mode can override them on this device (`localStorage`), and publishing a new `rates.json` on GitHub updates every install. If this document and the code disagree on *behaviour*, this document wins. If a live rate disagrees with the tables below, the live `rates.json` / device override wins. If this document disagrees with the Agreement, **the Agreement wins** — file the correction.

---

## 0. THE OFFICIAL BASIS

Every formula in this file traces to **Clauses 34–36 of the Singapore Airlines Staff Members' Agreement 2025 (CA No.058/2025, ASCA N (120925))**, verified line-by-line against the official document on 7 October 2026 — the full Agreement is committed at `docs/CA_058_of_2025_Singapore_Airlines_Staff_Members_Agreement.pdf` (Clauses 34–36 are the ones this app implements):

- **Clause 34 — Incentive Flying Allowance.** Paid per hour flown, in addition to basic salary. Sets the hourly rates by grade (34(2)(a)), the scheduled-duty-period multipliers (34(2)(b)), the delay multipliers based on Actual Duty Period (34(2)(c)), the 85-hour excess rule (34(3)), deadheading (34(4)), positioning (34(5)), diversions (34(6)) and the definitions of duty periods and flying hours (34(7)).
- **Clause 35 — Turnaround Allowance.** $90 per turnaround flight; a 4-sector COP of two consecutive turnarounds earns both ($180). A turnaround is a duty that commences and ends at base with no overnight stop at any overseas slip station.
- **Clause 36 — Meal Allowances.** Reimbursements for meals on duty overseas at a slip station, payable when a meal window falls within duty time (36(2)); duty times run from the scheduled arrival to the **reporting time** for the next departure (36(3)); **a transit of three hours or more earns meals at the transit location, even without an overnight** (36(4)); rates are renegotiated every January (36(5)) — the current table is **wef 01 Jan 2026**.

Two definitions from Clause 34(7) anchor the math:

- **"Scheduled duty period" (SDP)** — the hours from the scheduled report time at the station where the crew come on duty, ending **30 minutes after scheduled engines off** at the station where the crew take rest. Our engine approximates this with fixed buffers (§1.1): 2.5h added to sectors departing Singapore, 1.5h to sectors departing an overseas station. The buffers encode report-before-departure plus the 30 minutes after engines off; real report times vary slightly per duty.
- **"Scheduled flying hours"** — scheduled departure to scheduled engines off: the block time our engine takes from the roster or the schedule API.

*Verification note: the Agreement copy used for the 7 Oct 2026 comparison has a blank multiplier cell for "Turnaround Flights with SDP ≤ 12 hours"; the 1.3× value our engine uses was confirmed from the owner's original document.*

**Known exclusions — official rules this engine does not yet model** (documented honestly, never silently approximated):

| Clause | Rule | Status |
|---|---|---|
| 34(2)(c) | Delay multipliers based on **Actual** Duty Period (e.g. a ≤12h turnaround delayed past 12h actual → 1.6×) | Not modelled — the engine works from scheduled times only |
| 34(3) | Hours beyond **85/month** paid at **1.5×** the hourly rate (scheduled hours only) | Not modelled — the engine computes per trip; no monthly top-up |
| 34(4) | **Deadheading** credited with the full scheduled flight time of the sectors flown | Not modelled — no deadhead input |
| 34(5) | Positioning for **compassionate reasons or illness** earns nothing | Not modelled — the 0.75 credit applies whenever Paxing is ticked |
| 34(6) | **Diversions** — hours from actual flight time of every sector operated | Not modelled — scheduled times only |

---

## 1. FORMULAS & MATH

### 1.1 IFA — Scheduled Duty Period (SDP)

```
SDP_sector = flight_time_hours + buffer

WHERE:
  buffer = sgBuffer      IF sector origin is Singapore      (default 2.5 = 2h 30m)
  buffer = stationBuffer IF sector origin is a foreign station (default 1.5 = 1h 30m)
```

**Plain English:** each sector's scheduled duty period equals its flight time plus a fixed buffer for where the sector departs. The buffers approximate the official definition (§0): report before departure, plus 30 minutes after engines off.

### 1.2 IFA — Total Trip SDP (Turnaround only)

```
total_SDP = Σ (SDP_sector_i)   for all valid sectors i
```

### 1.3 IFA — Multiplier Selection

**Layover (per-sector SDP):**

| Condition | Multiplier |
|---|---|
| `SDP_sector ≤ 14` | 1.3 |
| `14 < SDP_sector ≤ 18` | 2.5 |
| `SDP_sector > 18` | 3.0 |

**Turnaround (TOTAL trip SDP):**

| Condition | Multiplier |
|---|---|
| `total_SDP ≤ 12` | 1.3 |
| `12 < total_SDP ≤ 14` | 1.6 |
| `14 < total_SDP ≤ 18` | 2.5 |
| `total_SDP > 18` | 3.0 |

> **CRITICAL:** turnaround uses the **summed** SDP across all sectors; layover uses each sector's **individual** SDP. This is the single most important asymmetry in the engine. Both ladders are Clause 34(2)(b) verbatim (the "any flight" rows there cover layovers above 14h).

### 1.4 IFA — Multiplier Overrides

```
IF isDirectUS == true:
    multiplier = directUSMultiplier       (default 3.5, no hour condition — Clause 34(2)(b))

IF isPaxing == true:
    multiplier = paxingMultiplier         (default 0.75)
    SDP is IGNORED entirely
```

**Precedence:** Paxing and Direct US are mutually exclusive in the UI (§4.2); when both would be true, the paxing branch is evaluated first inside `calcSector`.

> **Owner ruling (2026-10-07): the app keeps the flat 0.75×.** Clause 34(5) credits a positioning crew with **0.75 × the scheduled flying hours**, after which the normal multiplier ladder applies — identical to ours for turnarounds (the shared multiplier commutes), different for layovers (the official reading keeps the bracket uplift; ours pays a flat 75%). The owner has reviewed the difference and ruled the flat multiplier stays as shipped.

### 1.5 IFA — Sector Allowance

```
Normal:
  allowance_sector = flight_time_hours × base_rate × multiplier

Paxing:
  allowance_sector = flight_time_hours × base_rate × paxingMultiplier
```

### 1.6 IFA — Turnaround Bonus

```
turnaround_bonus_count = 2  IF flight_type == Turnaround AND is4Sector
turnaround_bonus_count = 1  IF flight_type == Turnaround AND NOT is4Sector
turnaround_bonus_count = 0  IF flight_type == Layover

turnaround_bonus = turnaround_bonus_count × turnaroundBonusAmount   (default 90.00 — Clause 35)
```

### 1.7 IFA — Trip Total

```
IFA_total = Σ (allowance_sector_i) + turnaround_bonus
```

### 1.8 LMA — Presence at a Slip Station

Duty time at a slip station runs from the **scheduled arrival** to the **report time for the next departure** — Clause 36(3). The engine takes the report time as **one hour before the scheduled departure**:

```
arrival_boundary   = arrival time (station local)
departure_boundary = departure time − 60 minutes   (the report time)
```

A report before midnight (departure before 01:00) lands negative and simply earns nothing on the departure day.

### 1.9 LMA — Meal Eligibility (Same-Day, including transits)

```
transit_minutes = departure_boundary − arrival_boundary

meal_earned = (transit_minutes ≥ 180)
    AND (arrival_minutes ≤ meal_window_end_minutes)
    AND (departure_boundary_minutes ≥ meal_window_start_minutes)
```

**Plain English:** a same-day presence earns a meal only when it is a **transit of three hours or more** (Clause 36(4)) *and* the crew were present for the whole window. A 2-hour turn that happens to straddle the lunch window pays nothing.

### 1.10 LMA — Meal Eligibility (Multi-Day)

```
ARRIVAL DAY:
    meal_earned = (arrival_minutes ≤ meal_window_end_minutes)

FULL DAYS (every calendar day strictly between arrival and departure):
    breakfast = lunch = dinner = true

DEPARTURE DAY:
    meal_earned = (departure_boundary_minutes ≥ meal_window_start_minutes)
```

### 1.11 LMA — Sector and Trip Totals

```
LMA_sector_total = (breakfast_count × breakfast_rate) + (lunch_count × lunch_rate) + (dinner_count × dinner_rate)
LMA_trip_total   = Σ (LMA_sector_total_i)
```

### 1.12 Grand Total

```
grand_total = IFA_total + LMA_trip_total
```

LMA contributes on layovers **and on turnarounds with a 3h+ overseas transit** (Clause 36(4)); a plain turnaround carries no LMA stations and contributes 0.

### 1.13 Duration Parsing

```
HH:MM → decimal hours:  hours = floor(HH) + (MM / 60)      e.g. 07:30 → 7.5
decimal → HH:MM:        total_minutes = round(h × 60); HH = floor(m/60); MM = m mod 60
```

---

## 2. INPUTS & VARIABLES

### 2.1 IFA Inputs

| Input | Type | Default | Constraint |
|---|---|---|---|
| `rank` | enum (5 values) | `FS/FSS` | one of RANK_OPTIONS |
| `flightType` | enum | `Layover` | `Layover` \| `Turnaround` |
| `is4Sector` | boolean | `false` | — |
| `times[0..3]` | `HH:MM` | `""` | minutes 0–59; hours ≥ 0 |
| `flightNumber[0..3]` / `fetchDate[0..3]` | string / `YYYY-MM-DD` | `""` / today | optional; Fetch fills times |
| `directUS[0..3]`, `paxing[0..3]` | boolean | `false` | — |
| `turnaroundStations[0..1]` | IATA | `""` | 3 chars, must match DB |
| `turnaroundArchiveMonth` | `YYYY-MM` | current month | valid month |

**Sector count:** 2 (default) or 4. Indices 0–1 always active; 2–3 only when `is4Sector`.

**Sector origin flags (`isSingapore`):**

| Mode | Sector 1 | Sector 2 | Sector 3 | Sector 4 |
|---|---|---|---|---|
| 2-sector | Singapore | Station | — | — |
| 4-sector Turnaround | Singapore | Station | Singapore | Station |
| 4-sector Layover | Singapore | Station | Station | Station |

**Fetch (optional):** `/api/getcabin` then `/api/menu` for the first published cabin (JCL preferred). Block time = UTC arrival − UTC departure. LMA in/out times come from adjacent sectors; the LMA **out** date is the next sector's typed flight date; **in** is the previous sector's local arrival. Local SQ date-times parse as **station local**, never UTC. Live schedule data exists from today − 2 days through today + 6 weeks. On a 2-sector layover, Fetch ticks Direct US when either end is a US airport (`countryCode === US`); the crew can untick. Multi-leg menus pick the unused dep→arr pair, preferring continuity with the adjacent sector.

### 2.2 LMA Inputs

| Input | Type | Default | Constraint |
|---|---|---|---|
| `airportCode` | IATA | `""` | 3 chars, must exist in DB |
| `arrivalDate` / `arrivalTime` | `YYYY-MM-DD` / `HH:MM` | today / `""` | station local |
| `departureDate` / `departureTime` | `YYYY-MM-DD` / `HH:MM` | today + 2d / `""` | ≥ arrivalDate; station local |
| `shuttle` | boolean | `false` | per station; if true, LMA = $0 (§4.3a) |

**Roster import (prefill source):** a Crew Roster Report PDF fills flight numbers, dates, sector flight times, and the LMA stations — layover slip stations as before, plus (v1.40.0) a **turnaround's overseas transits of 3h+** (scheduled arrival to report time) as same-day LMA stations. Port-local times are used exactly as printed; anything the parser cannot read with confidence is reported and left for manual entry — never guessed. **Calculate all** runs the same per-trip math over every built card — there is no separate calculation path — and its Save files each trip as its own archive entry. Saved entries store the structured snapshot frozen at calculate time, so a reopened summary always shows what was actually computed that day, even after rates change.

### 2.3 Units & Currency

| Quantity | Unit | Symbol |
|---|---|---|
| Monetary amounts | Singapore Dollars | `$` |
| Flight time / SDP / buffers | Hours (decimal internally, HH:MM displayed) | `h` |
| Multipliers | Dimensionless ratio | `×` |

### 2.4 Empty / Incomplete Input Handling

A sector is **incomplete** and excluded when: IFA — `parseDuration(time)` is `null` or hours ≤ 0; LMA — region unresolved, dates empty, or times unparseable. Incomplete sectors return `null` and contribute 0. **The app never crashes on empty input.**

---

## 3. MODIFIERS & TIERS

### 3.1 IFA Rank Tiers (Base Hourly Rates) — Clause 34(2)(a)

| Rank | Rate ($/flight hour) |
|---|---|
| Jr. FS/FSS — **24 months or less since first solo** | 10.00 |
| FS/FSS — more than 24 months since first solo | 13.50 |
| LS/LSS | 16.00 |
| CS/CSS | 18.50 |
| IFM | 23.00 |

> The rank pills list the crew's real ranks (FS/LS/CS/IFM or FSS/LSS/CSS/IFM) — the Junior tier is never picked. Onboarding asks for the **date of first solo** (masked DD/MM/YYYY), and for FS/FSS the app derives the tier per flight date: a trip flown within 24 months of the first solo prices at the Junior rate; from the anniversary on, the full rate. Other ranks never tier. A profile saved before this hotfix (no solo date on file) keeps its stored rank — including a legacy picked "Jr." rank.

### 3.2 IFA Multiplier Brackets — Layover (Clause 34(2)(b))

| Bracket | Condition | Multiplier |
|---|---|---|
| 1 | SDP ≤ 14h | 1.3× |
| 2 | SDP > 14h AND ≤ 18h | 2.5× |
| 3 | SDP > 18h | 3.0× |

### 3.3 IFA Multiplier Brackets — Turnaround (Clause 34(2)(b))

| Bracket | Condition | Multiplier |
|---|---|---|
| 1 | Total SDP ≤ 12h | 1.3× |
| 2 | Total SDP > 12h AND ≤ 14h | 1.6× |
| 3 | Total SDP > 14h AND ≤ 18h | 2.5× |
| 4 | Total SDP > 18h | 3.0× |

### 3.4 IFA Overrides

| Modifier | Value | Effect |
|---|---|---|
| Direct US | 3.5× | Replaces any bracket multiplier for that sector (no hour condition) |
| Paxing | 0.75× | Replaces multiplier; SDP ignored entirely (see §1.4 deviation note) |

### 3.5 IFA Turnaround Bonus — Clause 35

| Condition | Bonus |
|---|---|
| Turnaround, 2-sector | $90.00 (1 × 90) |
| Turnaround, 4-sector (two consecutive turnarounds) | $180.00 (2 × 90) |
| Layover (any) | $0.00 |

### 3.6 LMA Region Rate Tiers — Clause 36(5), wef 01 Jan 2026

| Region | Breakfast | Lunch | Dinner | Daily total |
|---|---|---|---|---|
| Australia / New Zealand | 50 | 86 | 111 | 247 |
| Orient | 57 | 100 | 128 | 285 |
| North America | 51 | 90 | 115 | 256 |
| Europe | 53 | 92 | 119 | 264 |
| Japan | 52 | 92 | 118 | 262 |
| Middle East | 40 | 70 | 91 | 201 |
| South Africa | 28 | 50 | 64 | 142 |
| South Asia | 36 | 64 | 82 | 182 |
| Southeast Asia | 31 | 55 | 70 | 156 |

`daily_total = breakfast + lunch + dinner` (informational display only). **Rates are renegotiated every January** — publish a new `rates.json` each year; the 2026 table above is current until 31 Dec 2026.

### 3.7 LMA Meal Windows (Station Local Time) — Clause 36(2), all times inclusive

| Meal | Start | End | Badge |
|---|---|---|---|
| Breakfast | 07:30 | 08:30 | B (orange) |
| Lunch | 12:30 | 13:30 | L (sky blue) |
| Dinner | 19:30 | 20:30 | D (violet) |

### 3.8 Airport → Region Mapping

Region derives from the airport's **ISO country code**, not the airport. All China airports map to **Orient**.

| Region | Country codes |
|---|---|
| Australia / New Zealand | AU, NZ, FJ, PF, WS, TO, NC, VU, SB, PG |
| Orient | CN, HK, MO, TW, KR, MN |
| Japan | JP |
| North America | US, CA, MX, BR, AR, CL, PE, CO, EC, VE, UY, PY, BO, PA, CR, SV, GT, HN, NI, BZ, CU, DO, PR, JM, BS, TT, BB, AW, CW |
| Europe | GB, FR, DE, NL, ES, IT, PT, CH, AT, BE, LU, IE, DK, NO, SE, FI, IS, GR, TR, PL, CZ, HU, RO, BG, RS, HR, SI, MK, AL, SK, EE, LV, LT, UA, RU, GE, AM, AZ, MT, CY |
| Middle East | AE, QA, SA, BH, KW, OM, JO, LB, IL, EG, DZ, MA, TN, LY, IQ, IR, SD, ET, KZ, UZ, KG, TJ, TM |
| South Africa | ZA, KE, NG, GH, TZ, UG, MZ, MW, ZW, ZM, BW, NA, MU, MG, SC, SN, CI, LR, CM, CD, CG, GA, RE, RW |
| South Asia | IN, PK, BD, LK, MV, NP, BT |
| Southeast Asia | SG, MY, TH, ID, PH, VN, MM, KH, LA, BN, TL |

---

## 4. CONDITIONAL RULES (IF / THEN)

### 4.1 IFA Multiplier Selection

```
IF isDirectUS == true
    THEN multiplier = 3.5                       ("Direct US flight → 3.5×")
ELSE IF isPaxing == true
    THEN multiplier = 0.75, SDP ignored         ("Paxing → 0.75× (SDP ignored)")
ELSE IF flightType == "Turnaround"
    THEN multiplier = turnaround_bracket(Σ SDP_all_sectors), shared by ALL non-paxing sectors
ELSE (Layover)
    THEN multiplier = layover_bracket(SDP_this_sector), per sector
```

### 4.2 Modifier Combinations (UI visibility)

| Condition | Direct US | Paxing |
|---|---|---|
| Layover + 2-sector | ✅ Show | ✅ Show |
| Layover + 4-sector | ❌ Hide | ❌ Hide |
| Turnaround + 2-sector | ❌ Hide | ✅ Show |
| Turnaround + 4-sector | ❌ Hide | ❌ Hide |

```
canShowDirectUS = (flightType == "Layover") AND (is4Sector == false)
canShowPaxing   = (is4Sector == false)
```

### 4.3a Shuttle (no LMA at that station)

```
IF LMA station shuttle == true
    THEN LMA_sector_total = 0, no meals earned, IFA unchanged
```

Shuttle is a **per-station** skip. Auto-fill ticks it only for **under-3-hour turns** (Clause 36(4)): ground time from scheduled arrival to report time below 3h. Do **not** hardcode flight numbers; the crew can untick.

### 4.3 LMA Section Visibility

```
IF flightType == "Turnaround" AND no LMA station data on the card
    THEN the LMA section stays hidden          (a plain turnaround earns no LMA)
ELSE
    THEN the LMA section shows                 (layovers, and turnarounds whose
                                                roster prefill carried a 3h+ transit)
```

### 4.4 LMA Same-Day vs Multi-Day

```
IF dateDiffDays(arrivalDate, departureDate) == 0
    THEN same-day logic (§1.9) — the 3h transit gate applies
ELSE IF dateDiffDays > 0
    THEN arrival-day (§1.10) + full days + departure-day (§1.10, report-time boundary)
ELSE
    THEN empty result (invalid: departure before arrival)
```

### 4.5 LMA Date Chaining (4-Sector Mode)

```
IF user changes sector[i].arrivalDate
    THEN sector[i].departureDate = arrivalDate + 1 day
    AND cascade: sector[j>i].arrivalDate = sector[j-1].departureDate + 1 day, departureDate = arrivalDate + 1 day

IF user changes sector[i].departureDate
    THEN keep it, cascade later sectors the same way
```

### 4.6 Archive Amount Source

```
amount = IFA_total + LMA_trip_total    (always — v1.40.0: a turnaround with a
                                        3h+ transit files the full COP, Clause 36(4))
IF amount ≤ 0 → nothing to save
```

---


## 5. EDGE CASES & ROUNDING

### 5.1 Rounding Rules

| Quantity | Rule |
|---|---|
| Monetary outputs | Round to 2 decimals **at display time only** (`$X.XX` via `toFixed(2)`) |
| Internal calculations | Never round — full floating-point precision; totals sum unrounded |
| Flight hours | Round to nearest minute for HH:MM display |

`7.5 × 13.5 × 1.3 = 131.625 → "$131.63"; 140.40 + 131.625 = 272.025 → "$272.03"`.

### 5.2 Boundary Conditions (Inclusive/Exclusive)

All bracket upper bounds are **inclusive** (`≤`), lower bounds strict (`>`). Exactly 14.0 layover SDP → 1.3×; exactly 12.0 turnaround total SDP → 1.3×. Meal windows: `arrival ≤ end` inclusive; `departure_boundary ≥ start` inclusive. The 3-hour transit gate is **inclusive** (exactly 180 minutes earns). The report-time subtraction (−60 min) happens before every departure-side comparison.

### 5.3 Zero & Negative Handling

| Case | Behaviour |
|---|---|
| Flight time empty or `00:00` | Sector excluded, contributes 0 |
| Departure date before arrival date | LMA empty result |
| Same-day transit under 3h (arrival→report) | No meals, honest $0 row |
| Region unresolved (bad IATA) | LMA empty result |
| IFA total = 0 | No result rendered |
| Archive amount ≤ 0 | Save aborted |

### 5.4 Date Arithmetic Safety

**Never use `toISOString()`** — it converts to UTC and shifts dates backward in positive-offset timezones (UTC+8 turns Jan 1 into Dec 31).

```
// WRONG:  d.toISOString().split("T")[0]
// CORRECT: new Date(y, m-1, d); d.getFullYear(), d.getMonth()+1, d.getDate()
// Parsing YYYY-MM-DD locally: append T00:00:00 — new Date("2025-01-01T00:00:00")
```

---

## 6. VERIFICATION TEST CASES

### IFA Test 1 — Turnaround, Total-SDP Rule

```
rank=Jr. FS/FSS, type=Turnaround, SG=04:00, ST=04:00, directUS=no, paxing=no
baseRate = 10.00
SG SDP = 4.0 + 2.5 = 6.5h;  ST SDP = 4.0 + 1.5 = 5.5h;  totalSDP = 12.0h → ≤12 → 1.3×
SG allowance = 4.0 × 10 × 1.3 = 52.00;  ST allowance = 52.00;  bonus = 1 × 90 = 90.00
TOTAL = 194.00 ✓
```

### IFA Test 2 — Layover, Per-Sector SDP

```
rank=FS/FSS, type=Layover, SG=08:00, ST=07:30
SG SDP = 10.5h → 1.3×;  ST SDP = 9.0h → 1.3×
SG = 8.0 × 13.5 × 1.3 = 140.40;  ST = 7.5 × 13.5 × 1.3 = 131.625 → $131.63
TOTAL = 272.025 → $272.03 ✓
```

### IFA Test 3 — Turnaround, High Total SDP

```
rank=CS/CSS, type=Turnaround, SG=11:00, ST=10:30
SG SDP = 13.5h;  ST SDP = 12.0h;  totalSDP = 25.5h → >18 → 3.0×
SG = 11.0 × 18.5 × 3.0 = 610.50;  ST = 10.5 × 18.5 × 3.0 = 582.75;  bonus = 90.00
TOTAL = 1283.25 ✓
```

### IFA Test 4 — Layover, Direct US Override

```
rank=IFM, type=Layover, SG=17:30, ST=18:00, directUS=yes/yes
SG = 17.5 × 23 × 3.5 = 1408.75;  ST = 18.0 × 23 × 3.5 = 1449.00;  bonus = 0
TOTAL = 2857.75 ✓
```

### LMA Test 5 — Same-Day Transit, the 3-Hour Gate (Clause 36(4))

```
Station KUL (Southeast Asia: B 31 / L 55 / D 70), same day:
  arrival 10:00, departure 15:30 → report 14:30 → transit = 4.5h ≥ 3h
  Breakfast: arrival 10:00 > 08:30 → no.   Lunch: 10:00 ≤ 13:30 AND 14:30 ≥ 12:30 → YES ($55).
  Dinner: 14:30 < 19:30 → no.
  LMA = $55.00 ✓

Same station, arrival 12:00, departure 14:30 → report 13:30 → transit = 1.5h < 3h
  → NO meals, $0.00 — even though the turn straddles the lunch window ✓
```

### LMA Test 6 — Multi-Day Layover, Report-Time Boundary (Clause 36(3))

```
Station NRT (Japan: B 52 / L 92 / D 118), arrive 21:55 Mon, depart 12:15 Thu
  Mon (arrival): 21:55 > 20:30 → dinner NO
  Tue, Wed (full days): B + L + D each = 262 × 2 = 524
  Thu (departure): report 11:15 — breakfast 11:15 > 08:30 NO; lunch 11:15 < 12:30 NO; dinner NO
  LMA = $524.00 ✓   (the old departure-time rule would also have paid nothing here —
  the boundary matters when departure sits within an hour above a window start)
```
