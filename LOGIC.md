# LOGIC.md — Calculation Engine & Business Rules Specification

> **Source of truth for all numeric logic.** If this document and the code disagree, this document wins.
> Any change to calculation behaviour MUST be reflected here first, then in code.

---

## 1. FORMULAS & MATH

### 1.1 IFA — Scheduled Duty Period (SDP)

```
SDP_sector = flight_time_hours + buffer

WHERE:
  buffer = sgBuffer      IF sector origin is Singapore
  buffer = stationBuffer IF sector origin is a foreign station
```

**Plain English:** Each sector's scheduled duty period equals its flight time plus a fixed buffer that depends on whether the sector departs from Singapore or from the overseas station.

**Defaults:** `sgBuffer = 2.5` (2h 30m), `stationBuffer = 1.5` (1h 30m)

---

### 1.2 IFA — Total Trip SDP (Turnaround only)

```
total_SDP = Σ (SDP_sector_i)   for all valid sectors i
```

**Plain English:** For turnaround flights, add up the SDP of every valid sector to get one trip-wide total.

---

### 1.3 IFA — Multiplier Selection

**Layover (per-sector SDP):**
```
multiplier = f_layover(SDP_sector)
```

| Condition | Multiplier |
|---|---|
| `SDP_sector ≤ 14` | 1.3 |
| `14 < SDP_sector ≤ 18` | 2.5 |
| `SDP_sector > 18` | 3.0 |

**Turnaround (TOTAL trip SDP):**
```
multiplier = f_turnaround(total_SDP)
```

| Condition | Multiplier |
|---|---|
| `total_SDP ≤ 12` | 1.3 |
| `12 < total_SDP ≤ 14` | 1.6 |
| `14 < total_SDP ≤ 18` | 2.5 |
| `total_SDP > 18` | 3.0 |

> **CRITICAL:** Turnaround uses the **summed** SDP across all sectors. Layover uses each sector's **individual** SDP. This is the single most important asymmetry in the engine.

---

### 1.4 IFA — Multiplier Overrides

```
IF isDirectUS == true:
    multiplier = directUSMultiplier       (default 3.5)

IF isPaxing == true:
    multiplier = paxingMultiplier         (default 0.75)
    SDP is IGNORED entirely
```

**Precedence:** Paxing and Direct US are mutually exclusive in the UI by design (see §4.4). When both flags would somehow be true, the paxing branch is evaluated first inside `calcSector`.

---

### 1.5 IFA — Sector Allowance

```
Normal:
  allowance_sector = flight_time_hours × base_rate × multiplier

Paxing:
  allowance_sector = flight_time_hours × base_rate × paxingMultiplier
```

**Plain English:** A sector's allowance is flight hours multiplied by the rank's hourly rate, multiplied by the applicable multiplier.

---

### 1.6 IFA — Turnaround Bonus

```
turnaround_bonus_count = 2  IF flight_type == Turnaround AND is4Sector
turnaround_bonus_count = 1  IF flight_type == Turnaround AND NOT is4Sector
turnaround_bonus_count = 0  IF flight_type == Layover

turnaround_bonus = turnaround_bonus_count × turnaroundBonusAmount   (default 90.00)
```

---

### 1.7 IFA — Trip Total

```
IFA_total = Σ (allowance_sector_i) + turnaround_bonus
```

---

### 1.8 LMA — Meal Eligibility (Same-Day)

```
meal_earned =
    (arrival_minutes ≤ meal_window_end_minutes)
    AND
    (departure_minutes ≥ meal_window_start_minutes)
```

**Plain English:** On a same-day layover, a meal counts only if the crew member is present for the entire meal window — they arrived at or before the window closed AND depart at or after it opened.

---

### 1.9 LMA — Meal Eligibility (Multi-Day)

```
ARRIVAL DAY:
    meal_earned = (arrival_minutes ≤ meal_window_end_minutes)

DEPARTURE DAY:
    meal_earned = (departure_minutes ≥ meal_window_start_minutes)

FULL DAYS (every calendar day strictly between arrival and departure):
    breakfast_earned = true
    lunch_earned     = true
    dinner_earned    = true
```

---

### 1.10 LMA — Sector Total

```
LMA_sector_total =
      (breakfast_count × breakfast_rate)
    + (lunch_count     × lunch_rate)
    + (dinner_count    × dinner_rate)
```

---

### 1.11 LMA — Trip Total (Multi-Sector)

```
LMA_trip_total = Σ (LMA_sector_total_i)   for all sectors
```

---

### 1.12 Sticky Bar — Grand Total

```
grand_total = IFA_total + effective_LMA_total

WHERE:
  effective_LMA_total = LMA_trip_total  IF LMA is eligible
  effective_LMA_total = 0               IF IFA flight type is Turnaround
```

---

### 1.13 Duration Parsing

```
HH:MM → decimal hours:
  hours = floor(HH) + (MM / 60)
```

**Example:** `07:30` → `7 + 30/60` → `7.5` hours

---

### 1.14 Decimal Hours → HH:MM Display

```
total_minutes = round(decimal_hours × 60)
HH = floor(total_minutes / 60)
MM = total_minutes mod 60
```

---

## 2. INPUTS & VARIABLES

### 2.1 IFA Inputs

| Input | Type | Default | Constraint | Unit |
|---|---|---|---|---|
| `rank` | enum (5 values) | `FS/FSS` | one of RANK_OPTIONS | — |
| `flightType` | enum | `Layover` | `Layover` \| `Turnaround` | — |
| `is4Sector` | boolean | `false` | — | — |
| `times[0..3]` | string `HH:MM` | `""` (empty) | minutes 0–59; hours ≥ 0 | hours:minutes |
| `directUS[0..3]` | boolean | `false` | — | — |
| `paxing[0..3]` | boolean | `false` | — | — |
| `turnaroundStations[0..1]` | IATA string | `""` | 3 chars, must match DB | — |
| `turnaroundArchiveMonth` | `YYYY-MM` | current month | valid month | — |

**Sector count:** 2 (default) or 4 (toggle on). Indices 0–1 always active; 2–3 only when `is4Sector`.

**Sector origin flags (`isSingapore`):**

| Mode | Sector 1 | Sector 2 | Sector 3 | Sector 4 |
|---|---|---|---|---|
| 2-sector | Singapore | Station | — | — |
| 4-sector Turnaround | Singapore | Station | Singapore | Station |
| 4-sector Layover | Singapore | Station | Station | Station |

### 2.2 LMA Inputs

| Input | Type | Default | Constraint | Unit |
|---|---|---|---|---|
| `airportCode` | IATA string | `""` | 3 chars, must exist in DB | — |
| `arrivalDate` | `YYYY-MM-DD` | today | valid date | date |
| `arrivalTime` | `HH:MM` | `""` (empty) | 00:00–23:59 | time (station local) |
| `departureDate` | `YYYY-MM-DD` | today + 2 days | ≥ arrivalDate | date |
| `departureTime` | `HH:MM` | `""` (empty) | 00:00–23:59 | time (station local) |

**4-sector mode:** `sectors[0..2]`, each with the above fields. Date chaining auto-populates downstream dates.

### 2.3 Units & Currency

| Quantity | Unit | Symbol |
|---|---|---|
| All monetary amounts | Singapore Dollars | `$` (SGD) |
| Flight time / SDP | Hours (decimal internally, HH:MM displayed) | `h` |
| Buffers | Hours (decimal) | `h` |
| Multipliers | Dimensionless ratio | `×` |
| Meal counts | Integer count | — |
| Layover duration | Days / nights | — |

### 2.4 Empty / Incomplete Input Handling

A sector is considered **incomplete** and excluded from calculation when:
- IFA: `parseDuration(time)` returns `null` OR `hours ≤ 0`
- LMA: region unresolved, OR arrival/departure date empty, OR either time unparseable

Incomplete sectors return `null` and contribute `0` to totals. **The app never crashes on empty input.**

---

## 3. MODIFIERS & TIERS

### 3.1 IFA Rank Tiers (Base Hourly Rates)

| Rank | Rate ($/flight hour) |
|---|---|
| Jr. FS/FSS | 10.00 |
| FS/FSS | 13.50 |
| LS/LSS | 16.00 |
| CS/CSS | 18.50 |
| IFM | 23.00 |

> The rank dropdown **is** the pay tier. No separate years-of-service input.

### 3.2 IFA Multiplier Brackets — Layover

| Bracket | Condition | Multiplier |
|---|---|---|
| 1 | SDP ≤ 14h | 1.3× |
| 2 | SDP > 14h AND ≤ 18h | 2.5× |
| 3 | SDP > 18h | 3.0× |

### 3.3 IFA Multiplier Brackets — Turnaround

| Bracket | Condition | Multiplier |
|---|---|---|
| 1 | Total SDP ≤ 12h | 1.3× |
| 2 | Total SDP > 12h AND ≤ 14h | 1.6× |
| 3 | Total SDP > 14h AND ≤ 18h | 2.5× |
| 4 | Total SDP > 18h | 3.0× |

### 3.4 IFA Overrides

| Modifier | Value | Effect |
|---|---|---|
| Direct US | 3.5× | Replaces any bracket multiplier for that sector |
| Paxing | 0.75× | Replaces multiplier; SDP ignored entirely |

### 3.5 IFA Bonus

| Condition | Bonus |
|---|---|
| Turnaround, 2-sector | $90.00 (1 × 90) |
| Turnaround, 4-sector | $180.00 (2 × 90) |
| Layover (any) | $0.00 |

### 3.6 LMA Region Rate Tiers

| Region | Breakfast | Lunch | Dinner | Daily Max |
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

`daily_max = breakfast + lunch + dinner` (informational display only)

### 3.7 LMA Meal Windows (Station Local Time)

| Meal | Start | End | Badge |
|---|---|---|---|
| Breakfast | 07:30 | 08:30 | B (orange) |
| Lunch | 12:30 | 13:30 | L (sky blue) |
| Dinner | 19:30 | 20:30 | D (violet) |

### 3.8 Airport → Region Mapping

Region is derived from the airport's **ISO country code**, not the airport itself. All China airports map to **Orient**.

| Region | Country Codes |
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
    THEN multiplier = 3.5
    AND reason = "Direct US flight → 3.5×"

ELSE IF isPaxing == true
    THEN multiplier = 0.75
    AND SDP is ignored
    AND reason = "Paxing → 0.75× (SDP ignored)"

ELSE IF flightType == "Turnaround"
    THEN compute total_SDP = Σ SDP_all_sectors
    AND multiplier = turnaround_bracket(total_SDP)
    AND apply SAME multiplier to ALL non-paxing sectors

ELSE (flightType == "Layover")
    THEN multiplier = layover_bracket(SDP_this_sector)
    AND each sector may have a DIFFERENT multiplier
```

### 4.2 IFA Toggle Visibility

```
IF flightType == "Turnaround"
    THEN hide all "Direct US flight?" toggles
    (reason: no Direct US turnaround flights exist)

IF flightType == "Turnaround" AND is4Sector == true
    THEN hide all "Paxing?" toggles
    (reason: no Paxing 4-sector turnaround flights exist)

IF flightType == "Layover" AND is4Sector == true
    THEN hide all "Direct US flight?" AND "Paxing?" toggles
    (reason: no 4-sector Direct US or Paxing layover flights exist)
```

**Consolidated visibility matrix:**

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

### 4.3 LMA Hidden When Turnaround

```
IF IFA flight type == "Turnaround"
    THEN hide the entire LMA accordion
    AND effective_LMA_total = 0
    (reason: LMA is not eligible for turnaround flights)

lmaEligible = (IFA_flight_type != "Turnaround")
```

### 4.4 LMA Same-Day vs Multi-Day

```
IF dateDiffDays(arrivalDate, departureDate) == 0
    THEN same-day logic (§1.8) for all three meals

ELSE IF dateDiffDays(arrivalDate, departureDate) > 0
    THEN arrival-day logic for arrival date
    AND full-day logic for every intermediate date
    AND departure-day logic for departure date

ELSE (dateDiffDays < 0)
    THEN return empty result (invalid: departure before arrival)
```

### 4.5 LMA Date Chaining (4-Sector Mode)

```
IF user changes sector[i].arrivalDate
    THEN sector[i].departureDate = arrivalDate + 1 day
    AND for each j > i:
        sector[j].arrivalDate   = sector[j-1].departureDate + 1 day
        sector[j].departureDate = sector[j].arrivalDate + 1 day

IF user changes sector[i].departureDate
    THEN keep that value
    AND for each j > i:
        sector[j].arrivalDate   = sector[i].departureDate + 1 day
        sector[j].departureDate = sector[j].arrivalDate + 1 day
```

**Plain English:** Changing any arrival date cascades forward through all later sectors. Changing a departure date keeps it but still cascades everything after it.

### 4.6 Sticky Bar Label Selection

```
IF IFA_total > 0 AND LMA_total > 0
    THEN label = "COP Allowance"
ELSE IF IFA_total > 0
    THEN label = "Total IFA"
ELSE IF LMA_total > 0
    THEN label = "Total LMA"
```

### 4.7 Sticky Bar Dynamic Headers

```
IF IFA is valid
    THEN header = "🛩️ IFA for {HH}H {MM}M flight"
    (HH/MM = total flight hours across all valid IFA sectors)

IF LMA is valid
    THEN header = "🍴 LMA for {station_summary}"
    (single: "LHR"; 4-sector: "LHR > NRT > JFK")
```

### 4.8 Developer Mode Unlock

```
IF (now - lastResetTapAt) ≤ 800ms
    THEN resetTapStreak += 1
ELSE
    THEN resetTapStreak = 1

IF resetTapStreak ≥ 10
    THEN toggle showDeveloperNote
    AND close all developer sub-accordions
    AND resetTapStreak = 0
```

### 4.9 Reset All Preservation Rules

```
On Reset All:
    RESET:    LMA sector inputs, IFA times, directUS flags, paxing flags
    PRESERVE: currently selected IFA rank
    PRESERVE: currently selected IFA flight type (Layover OR Turnaround)
    PRESERVE: IFA/LMA accordion open/close state
    PRESERVE: LMA regional rates (localStorage)
    PRESERVE: IFA modifiers (localStorage)
    PRESERVE: Allowances Archive (localStorage)
```

### 4.10 Archive Month Source

```
IF flightType == "Turnaround"
    THEN monthKey = developer Month & Year field value
ELSE (Layover)
    THEN monthKey = first sector's arrivalDate month/year
         (single mode: single.arrivalDate)
         (4-sector mode: sectors[0].arrivalDate)
```

### 4.11 Archive Station Display

```
IF flightType == "Turnaround"
    THEN codes = IFA turnaround station inputs
         2 codes → "AAA/BBB"
         1 code  → "AAA"
         4-sector turnaround → use only FIRST TWO codes

ELSE (Layover)
    THEN codes = LMA station inputs
         single    → "AAA"
         4-sector  → "AAA/BBB" (first two)
```

### 4.12 Archive Amount Source

```
IF flightType == "Turnaround"
    THEN amount = IFA_total only
ELSE (Layover)
    THEN amount = IFA_total + LMA_total (the COP allowance)
```

---

## 5. CALCULATION PIPELINE / SEQUENCE

### 5.1 IFA Pipeline

```
STEP 1  Receive inputs: rank, flightType, is4Sector, times[], directUS[], paxing[], cfg
STEP 2  baseRate = cfg.baseRates[rank]
STEP 3  Determine sectorCount = is4Sector ? 4 : 2
STEP 4  Build sectorIsSg[] array from flightType + is4Sector
STEP 5  Parse each time string → decimal hours (null if invalid)
STEP 6  IF flightType == "Turnaround":
            Compute SDP for each valid sector
            Sum all SDPs → total_SDP
            Look up ONE multiplier from turnaround brackets using total_SDP
            Store as sharedTurnaroundMultiplier
STEP 7  For each sector i:
            IF time invalid OR hours ≤ 0:
                sectorResult[i] = null   (skip)
            ELSE:
                SDP_i = flight_hours_i + buffer_i
                IF paxing[i]:
                    multiplier_i = cfg.paxingMultiplier (SDP ignored)
                ELSE IF flightType == "Turnaround":
                    multiplier_i = sharedTurnaroundMultiplier
                ELSE IF directUS[i]:
                    multiplier_i = cfg.directUSMultiplier
                ELSE:
                    multiplier_i = layover_bracket(SDP_i)
                allowance_i = flight_hours_i × baseRate × multiplier_i
STEP 8  Compute turnaroundBonusCount and turnaroundBonus
STEP 9  IFA_total = Σ allowance_i + turnaroundBonus
STEP 10 Build display labels, emojis, isSg arrays
STEP 11 Emit result to UI and parent (via onTotalChange)
```

### 5.2 LMA Pipeline

```
STEP 1  Receive: airportCode, arrivalDate, arrivalTime, departureDate, departureTime, rates
STEP 2  region = getRegionForAirport(airportCode)
        IF region == null → return empty result
STEP 3  Parse arrivalTime and departureTime
        IF either unparseable → return empty result
STEP 4  daysDiff = dateDiffDays(arrivalDate, departureDate)
        IF daysDiff < 0 → return empty result
STEP 5  regionRates = rates[region]
STEP 6  IF daysDiff == 0:
            Build ONE day entry (type = "same-day")
            For each meal: eligible = arrival ≤ mealEnd AND departure ≥ mealStart
        ELSE:
            Build arrival-day entry (type = "arrival")
            For each meal: eligible = arrival ≤ mealEnd
            For each intermediate day d (1 ≤ d < daysDiff):
                Build full-day entry (type = "full")
                All three meals eligible = true
            Build departure-day entry (type = "departure")
            For each meal: eligible = departure ≥ mealStart
STEP 7  For each day:
            For each eligible meal: add that meal's rate to the day total
STEP 8  Aggregate counts and totals across all days:
            breakfastCount, lunchCount, dinnerCount
            totalBreakfast, totalLunch, totalDinner
STEP 9  grandTotal = totalBreakfast + totalLunch + totalDinner
STEP 10 Emit result to UI and parent
```

### 5.3 Sticky Bar Pipeline

```
STEP 1  Receive ifaTotal, lmaTotal, ifaDetails, lmaDetails
STEP 2  lmaEligible = (IFA_flightType != "Turnaround")
STEP 3  effectiveLmaTotal = lmaEligible ? lmaTotal : 0
STEP 4  effectiveLmaDetails = lmaEligible ? lmaDetails : null
STEP 5  grandTotal = ifaTotal + effectiveLmaTotal
STEP 6  Select label per §4.6
STEP 7  Render bar IF (ifaTotal > 0 OR effectiveLmaTotal > 0)
```

### 5.4 Archive Save Pipeline

```
STEP 1  User presses "Save to archives"
STEP 2  Determine monthKey per §4.10
STEP 3  Determine stationDisplay per §4.11
STEP 4  Determine amount per §4.12
STEP 5  IF amount ≤ 0 → abort (nothing to save)
STEP 6  Construct AllowanceArchiveEntry
STEP 7  APPEND entry to END of archives array
STEP 8  Persist to localStorage
STEP 9  Show "Saved to archives" cue for 2200ms
STEP 10 Run calculator reset (preserving rank, flightType, accordion state)
```

---

## 6. EDGE CASES & ROUNDING

### 6.1 Rounding Rules

| Quantity | Rule | Display |
|---|---|---|
| All monetary outputs | Round to 2 decimal places at **display time only** | `$X.XX` via `toFixed(2)` |
| Internal calculations | **Never round** — keep full floating-point precision | — |
| Multiplier | Display as-is (e.g. `1.3×`) | `{value}×` |
| Flight hours | Round to nearest minute for HH:MM display | `HH:MM` |
| Layover duration | Integer days/nights | `{N} days, {N} nights` |

> **Critical:** Rounding happens ONLY in the presentation layer (`money()` helper = `$${n.toFixed(2)}`). Totals are summed from unrounded values, so `140.40 + 131.625 = 272.025` displays as `$272.03` (standard `toFixed` rounding).

### 6.2 Boundary Conditions (Inclusive/Exclusive)

All bracket boundaries use **`≤` for the upper bound** and strict `>` for the lower:

```
Layover:  SDP ≤ 14  → 1.3   |  SDP > 14 AND ≤ 18 → 2.5   |  SDP > 18 → 3.0
Turnaround: TSDP ≤ 12 → 1.3 |  TSDP > 12 AND ≤ 14 → 1.6  | TSDP > 14 AND ≤ 18 → 2.5 | TSDP > 18 → 3.0
```

**Boundary values:** Exactly 14.0 layover SDP → 1.3× (not 2.5×). Exactly 12.0 total turnaround SDP → 1.3× (not 1.6×).

**Meal windows:** `arrival ≤ mealEnd` is inclusive. `departure ≥ mealStart` is inclusive.

### 6.3 Zero & Negative Handling

| Case | Behaviour |
|---|---|
| Flight time empty or `00:00` | Sector excluded (`null`), contributes 0 |
| Flight time negative | Impossible via UI clamp; `parseDuration` returns `null` for negative |
| Minutes > 59 | `parseDuration` returns `null` |
| Departure date before arrival date | LMA returns empty result; UI shows error |
| Departure datetime ≤ arrival datetime | UI shows "Departure must be after arrival", results suppressed |
| Region unresolved (bad IATA) | LMA returns empty result |
| IFA total = 0 | Sticky bar does not render |
| Archive amount ≤ 0 | Save aborted |
| Negative rate in editor | Accepted numerically (dev tool) but produces negative allowance |

### 6.4 Input Clamping

| Input | Clamp |
|---|---|
| TimeInput hours | 0–23 |
| DurationInput hours | ≥ 0 (unbounded above) |
| TimeInput/DurationInput minutes | 0–59 |
| Airport code | Uppercase, A–Z / 0–9 / space only |

### 6.5 Cap Limits

There are **no hard caps** on allowance amounts. The only structural caps are:
- Maximum 4 IFA sectors
- Maximum 3 LMA layover sectors (4-sector mode)
- Turnaround bonus count caps at 2

### 6.6 Floating-Point Precision

Sector allowances are computed as `hours × rate × multiplier` without intermediate rounding. Sums accumulate unrounded. Example precision behaviour:

```
7.5 × 13.5 × 1.3 = 131.625      → displays "$131.63"
8.0 × 13.5 × 1.3 = 140.4        → displays "$140.40"
total            = 272.025      → displays "$272.03"
```

### 6.7 Date Arithmetic Safety

**NEVER use `toISOString()`** — it converts to UTC and shifts dates backward in positive-offset timezones (e.g. UTC+8 turns Jan 1 into Dec 31).

```
// WRONG — UTC shift bug:
d.toISOString().split("T")[0]

// CORRECT — local-time constructor + getters:
new Date(y, m - 1, d)
dt.getFullYear(), dt.getMonth() + 1, dt.getDate()
```

When parsing `YYYY-MM-DD` for local time, always append `T00:00:00`:
```
new Date("2025-01-01T00:00:00")   // local ✓
new Date("2025-01-01")            // may parse as UTC ✗
```

### 6.8 Empty Archive & Empty Month Handling

| Case | Behaviour |
|---|---|
| No archive entries | Displays `No archived allowances yet.` |
| Month with all entries deleted | Month window disappears automatically |
| Clear all | Empties array, persists `[]` |
| Corrupt localStorage JSON | `loadAllowanceArchives` returns `[]` |
| Corrupt IFA config JSON | `loadIfaConfig` returns `DEFAULT_IFA_CONFIG` |
| Corrupt LMA rates JSON | `loadRates` returns `DEFAULT_RATES` |

---

## 7. VERIFICATION TEST CASES

### IFA Test 1 — Turnaround, Total-SDP Rule
```
rank=Jr. FS/FSS, type=Turnaround, SG=04:00, ST=04:00, directUS=no, paxing=no
baseRate = 10.00
SG SDP  = 4.0 + 2.5 = 6.5h
ST SDP  = 4.0 + 1.5 = 5.5h
totalSDP = 6.5 + 5.5 = 12.0h  → bracket: ≤12 → 1.3×
SG allowance  = 4.0 × 10 × 1.3 = 52.00
ST allowance  = 4.0 × 10 × 1.3 = 52.00
bonus = 1 × 90 = 90.00
TOTAL = 194.00 ✓
```

### IFA Test 2 — Layover, Per-Sector SDP
```
rank=FS/FSS, type=Layover, SG=08:00, ST=07:30, directUS=no, paxing=no
baseRate = 13.50
SG SDP = 8.0 + 2.5 = 10.5h → ≤14 → 1.3×
ST SDP = 7.5 + 1.5 = 9.0h  → ≤14 → 1.3×
SG allowance = 8.0 × 13.5 × 1.3 = 140.40
ST allowance = 7.5 × 13.5 × 1.3 = 131.625 → $131.63
TOTAL = 272.025 → $272.03 ✓
```

### IFA Test 3 — Turnaround, High Total SDP
```
rank=CS/CSS, type=Turnaround, SG=11:00, ST=10:30, directUS=no, paxing=no
baseRate = 18.50
SG SDP = 11.0 + 2.5 = 13.5h
ST SDP = 10.5 + 1.5 = 12.0h
totalSDP = 25.5h → >18 → 3.0×
SG allowance = 11.0 × 18.5 × 3.0 = 610.50
ST allowance = 10.5 × 18.5 × 3.0 = 582.75
bonus = 90.00
TOTAL = 1283.25 ✓
```

### IFA Test 4 — Layover, Direct US Override
```
rank=IFM, type=Layover, SG=17:30, ST=18:00, directUS=yes/yes, paxing=no
baseRate = 23.00
Direct US overrides → 3.5× both
SG allowance = 17.5 × 23 × 3.5 = 1408.75
ST allowance = 18.0 × 23 × 3.5 = 1449.00
bonus = 0 (layover)
TOTAL = 2857.75 ✓
```
