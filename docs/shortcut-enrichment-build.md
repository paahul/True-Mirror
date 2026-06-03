# Shortcut Enrichment — Build Guide (Phase 2, step 2)

Builds on the working MVP (see `shortcut-mvp-build.md`). Goal: capture **all**
remaining metrics so the shared version is "one and done." We add 9 more metrics
plus per-day arrays.

**Status when starting this:** MVP works — steps, resting HR, active energy,
exercise (averages) → POST → analysis. This guide adds everything else.

> ✅ **Architecture decided (2026-06-01): this is the active path.**
> We considered a "thin Shortcut, fat backend" alternative (POST raw samples, aggregate
> server-side). An on-device test settled it: iOS won't serialize a health-sample list to
> JSON — it collapses the list to a single scalar — so raw ingest isn't viable and loops are
> unavoidable either way. Staying **fat** (aggregate in the Shortcut). Full reasoning in
> `architecture-thin-shortcut.md`. **Follow this guide as written.**

> ⚠️ Honesty note: I can't test Shortcuts on a device, so HealthKit action labels
> and a few parameters may differ slightly on your iOS version. Where I'm unsure,
> it's flagged. The MVP proved the hard parts (POST + JSON + permissions); the rest
> is mostly repeating patterns. Expect some on-device fiddling on sleep + daily arrays.

---

## The 5 reusable patterns

You already know patterns 1–2 from the MVP. Patterns 3–5 are new.

**Pattern A — "daily-average from cumulative" (steps/energy/exercise):**
Find Health Samples → Calculate Statistics **Sum** → Calculate **÷ 30** → Round → Set Variable.

**Pattern B — "average of ~daily samples" (resting HR, HRV, respiratory, SpO2):**
Find Health Samples → Calculate Statistics **Average** → Round → Set Variable.

**Pattern C — "single most-recent value" (VO2 max, latest weight):**
Find Health Samples → set **Sort by: Start Date**, **Limit: 1** (most recent) → it returns one sample → Set Variable. (You may need a **Round** or to read the sample's value; if the value comes through as a sample not a number, add a **Get Numbers from Input** action.)

**Pattern D — "daily array" (for trends + Recovery) — the fiddly one:**
Find Health Samples with **Group By: Day** → **Repeat with Each** (item in the grouped result) → inside the loop: Calculate Statistics (Sum or Average) for that day + get the day's date → build a **Dictionary** `{ "date": …, "<value-key>": … }` → **Add to Variable** (a list) → after the loop that list is your `daily` array. See the dedicated section below.

**Pattern E — "list of objects" (workouts):**
Find Workouts → Repeat with Each → build a Dictionary per workout → Add to Variable.

---

## Remaining metrics → pattern + JSON field

| Metric | HealthKit type | Pattern | JSON field(s) |
|---|---|---|---|
| HRV | Heart Rate Variability | B (avg) + D (daily) | `hrv_ms.average`, `hrv_ms.daily[]` |
| Sleep | Sleep Analysis | special (see below) | `sleep.average_hours_asleep`, stages, `sleep.daily[]` |
| VO2 max | VO2 Max | C (most recent) | `vo2_max_ml_kg_min` |
| Respiratory rate | Respiratory Rate | B (avg) | `respiratory_rate.avg_breaths_per_min` |
| Blood oxygen | Blood Oxygen | B (avg) | `spo2_percent.average` |
| Weight | Body Mass | C (latest) + earliest for delta | `weight_kg.latest`, `weight_kg.change_30d` |
| Stand hours | Apple Stand Hour | B-ish (avg count) | `stand_hours.daily_average` |
| Workouts | (Find Workouts) | E (loop) | `workouts[]` |
| Age | Date of Birth | one-off | `age_years` (used in Strain max-HR) |

**Priority order if you want to stop partway:**
1. **HRV (avg + daily)** — unlocks Recovery + Stress. Highest value.
2. **Sleep (hours)** — unlocks Sleep score.
3. **VO2 max, Weight** — cheap, high context.
4. **Workouts** — makes Strain accurate.
5. Respiratory rate, SpO2, stand hours, age — nice-to-have.

---

## HRV (do this first — unlocks Recovery)

**Average:**
1. Find Health Samples → **Heart Rate Variability** → filter last 30 Days
2. Calculate Statistics → **Average** → Round → Set Variable `HRVAvg`

**Daily array:** see the "Daily arrays" section — HRV daily is **required** for the Recovery score (needs ≥7 days). Set Variable `HRVDaily`.

---

## Sleep (the trickiest — read carefully)

Sleep is stored as overlapping category samples (InBed, Asleep, AsleepCore/Deep/REM, Awake). Per-night, per-stage math is the hardest thing in this whole build.

**Pragmatic v1 — just average hours asleep (skip stages first):**
1. Find Health Samples → **Sleep Analysis** → filter last 30 Days → add a second filter if available: **Value is `Asleep`** (or category contains Asleep)
2. We need total asleep *time*. If Calculate Statistics offers **Sum** over a duration, use it; otherwise sum sample durations. Then convert: total minutes ÷ 30 days ÷ 60 = avg hours/night.
   - Calculate Statistics **Sum** → Calculate **÷ 30** (per night) → Calculate **÷ 60** (to hours) → Round (to 1 decimal is fine; Round to nearest 0.1) → Set Variable `SleepHours`
3. JSON: `"sleep": { "average_hours_asleep": ‹SleepHours› }`

The Sleep score works from just `average_hours_asleep` (deep/REM/efficiency have fallbacks), so this alone unlocks a Sleep score.

**Stages (add later if you want a better Sleep score):** repeat with filters `AsleepDeep`, `AsleepREM`, `Awake`, summing minutes and ÷30 → `avg_deep_minutes`, `avg_rem_minutes`, `avg_awake_minutes`. This is fiddly and best iterated on-device.

> If sleep math gets painful, **ship without it first** — the API treats every
> health field as optional. Get HRV + the MVP metrics live, then return to sleep.

---

## VO2 max, Respiratory rate, SpO2, Weight

- **VO2 max:** Find → VO2 Max → Sort by Start Date, Limit 1 → Set Variable `VO2`. JSON: `"vo2_max_ml_kg_min": ‹VO2›` (top level, not nested).
- **Respiratory rate:** Pattern B → `RespAvg`. JSON: `"respiratory_rate": { "avg_breaths_per_min": ‹RespAvg› }`.
- **SpO2:** Pattern B (it's a fraction 0–1 in HealthKit; multiply ×100 to get a percent) → Round → `SpO2Avg`. JSON: `"spo2_percent": { "average": ‹SpO2Avg› }`.
- **Weight:** Find → Body Mass → Sort by Start Date.
  - Limit 1 (most recent) → `WeightLatest`
  - Separately, Find → Body Mass, Sort ascending, Limit 1 (earliest in period) → `WeightFirst`
  - Calculate `WeightLatest − WeightFirst` → Round (0.1) → `WeightDelta`
  - JSON: `"weight_kg": { "latest": ‹WeightLatest›, "change_30d": ‹WeightDelta› }`

---

## Stand hours (optional)

Find → Apple Stand Hour → filter last 30 Days. Each "Stood" hour is a sample.
Approx daily average = count of samples ÷ 30. Use Calculate Statistics **Count** (if available) ÷ 30, or just send a rough value. Low priority. JSON: `"stand_hours": { "daily_average": ‹StandAvg› }`.

---

## Workouts (Pattern E — a loop)

1. **Find Workouts** → filter last 30 Days
2. **Set Variable** `WorkoutsList` to an empty… actually: add **Repeat with Each** (over Find Workouts result)
3. Inside the repeat:
   - **Dictionary** action with keys: `date` (Repeat Item's Start Date formatted `yyyy-MM-dd`), `type` (Repeat Item's Workout Type), `duration_minutes` (Repeat Item's Duration in minutes), and if available `avg_hr_bpm`, `calories`, `distance_km`
   - **Add to Variable** `WorkoutsList` ← the Dictionary
4. After the loop, `WorkoutsList` is a list of dictionaries.
5. JSON: `"workouts": ‹WorkoutsList›` — insert the **WorkoutsList** variable directly as the value (it serializes to a JSON array).

> Getting per-workout fields out of the Repeat Item can be finicky — the "Workout Details" / magic-variable picker exposes Type, Duration, Distance, etc. Expect some trial-and-error here.

---

## Daily arrays (Pattern D — unlocks trends, Recovery, AND day-over-day)

This is what powers the history charts, the Recovery score, **and the "Since your last
full day" day-over-day card** (added 2026-06-03). Without daily arrays, both the 30-day ↑/↓
trend arrows and the day-over-day card stay hidden — the server has nothing per-day to diff.

Build it for **HRV first** (required), then add the rest. For the **day-over-day card** you
want the readiness metrics especially: **HRV, resting HR, sleep, respiratory rate, SpO2**
(steps/energy/exercise show too but fill out the pills rather than drive the headline).

For one metric (e.g., HRV):
1. **Find Health Samples** → Heart Rate Variability → last 30 Days → **Group By: Day**
   (Group By: Day returns one group per calendar day.)
2. **Set Variable** `HRVDaily` to an empty value (we'll append). *(Tip: to start an empty list, you can set it from an empty Text and then Add to Variable — or just Add to Variable inside the loop, which creates the list on first add.)*
3. **Repeat with Each** item in the grouped result. Inside:
   - **Calculate Statistics → Average** on the current group (the day's samples) → that's the day's HRV
   - Get the day's **date**: from the Repeat Item, take its Start Date → **Format Date** as `yyyy-MM-dd`
   - **Dictionary**: `{ "date": ‹formatted date›, "ms": ‹day average› }`
     (use the right value key per metric — see table below)
   - **Add to Variable** `HRVDaily` ← the Dictionary
4. After the loop, `HRVDaily` is the array.
5. JSON: `"hrv_ms": { "average": ‹HRVAvg›, "daily": ‹HRVDaily› }`

**Value keys per metric's daily entry:**

| Metric | daily entry shape | per-day stat |
|---|---|---|
| steps | `{ "date": …, "count": … }` | Sum |
| sleep | `{ "date": …, "hours_asleep": … }` | Sum (hours asleep) |
| resting HR | `{ "date": …, "bpm": … }` | Average |
| HRV | `{ "date": …, "ms": … }` | Average |
| active energy | `{ "date": …, "kcal": … }` | Sum |
| exercise | `{ "date": …, "minutes": … }` | Sum |
| respiratory rate | `{ "date": …, "breaths_per_min": … }` | Average |
| SpO2 | `{ "date": …, "pct": … }` | Average |

**Flat-key contract (your current Shortcut sends a FLAT body).** Add each finished array as
a top-level key — the server (`lib/normalize.ts`) maps these into the nested shape:

| Flat key | value | example item |
|---|---|---|
| `hrv_daily` | HRVDaily | `{ "date": "2026-06-02", "ms": 41 }` |
| `rhr_daily` | RHRDaily | `{ "date": "2026-06-02", "bpm": 58 }` |
| `sleep_daily` | SleepDaily | `{ "date": "2026-06-02", "hours_asleep": 7.1 }` |
| `steps_daily` | StepsDaily | `{ "date": "2026-06-02", "count": 8210 }` |
| `energy_daily` | EnergyDaily | `{ "date": "2026-06-02", "kcal": 540 }` |
| `exercise_daily` | ExDaily | `{ "date": "2026-06-02", "minutes": 32 }` |
| `resp_daily` | RespDaily | `{ "date": "2026-06-02", "breaths_per_min": 15.2 }` |
| `spo2_daily` | SpO2Daily | `{ "date": "2026-06-02", "pct": 97 }` |

> **Crash discipline (from `learnings.md`):** every 30-day Find that feeds a daily loop MUST
> have **Group By: Day** — dense metrics (esp. Active Energy) crash the Shortcut otherwise.
> For Watch users, keep the **Source filter → your Watch** on steps/energy/exercise so the
> per-day Sums aren't ~2× double-counted.
>
> The Repeat + Dictionary + Add-to-Variable loop is the most error-prone part. Build it for
> HRV, run it, and **Quick Look the `HRVDaily` variable** to confirm the array looks right
> before wiring more metrics.
>
> **Day boundary:** the server treats the newest day in each array as the still-in-progress
> day and compares the two most recent *completed* days — so you don't need to exclude
> "today" yourself, and running the Shortcut twice in a day (or across midnight) stays
> consistent. Just send whatever the 30-day window returns.

---

## The full JSON body (Text action)

Replace the MVP Text with this, inserting each variable chip. Omit any block you
haven't built yet — every field is optional.

```
{
  "save_history": true,
  "health": {
    "period_days": 30,
    "age_years": ‹Age›,
    "steps": { "average": ‹StepsAvg›, "total": ‹StepsTotal›, "daily": ‹StepsDaily› },
    "sleep": { "average_hours_asleep": ‹SleepHours›, "avg_deep_minutes": ‹DeepMin›, "avg_rem_minutes": ‹RemMin›, "avg_awake_minutes": ‹AwakeMin›, "daily": ‹SleepDaily› },
    "heart_rate": { "resting_average": ‹RHRAvg›, "daily_resting": ‹RHRDaily› },
    "hrv_ms": { "average": ‹HRVAvg›, "daily": ‹HRVDaily› },
    "vo2_max_ml_kg_min": ‹VO2›,
    "respiratory_rate": { "avg_breaths_per_min": ‹RespAvg›, "daily": ‹RespDaily› },
    "spo2_percent": { "average": ‹SpO2Avg›, "daily": ‹SpO2Daily› },
    "active_energy": { "average": ‹EnergyAvg›, "daily": ‹EnergyDaily› },
    "exercise_minutes": { "average": ‹ExAvg›, "daily": ‹ExDaily› },
    "workouts": ‹WorkoutsList›,
    "stand_hours": { "daily_average": ‹StandAvg› },
    "weight_kg": { "latest": ‹WeightLatest›, "change_30d": ‹WeightDelta› }
  }
}
```

Build incrementally: add a metric, Quick Look the Text, confirm valid JSON, run. Repeat.

---

## Troubleshooting (learned the hard way on 2026-05-31)

| Symptom | Cause / fix |
|---|---|
| `Invalid JSON` (400) | A variable is **empty** (e.g., you referenced a metric with no data) → leaves `"key": }`. Either ensure data exists or remove that block. Also check for **smart/curly quotes** (Settings → General → Keyboard → Smart Punctuation OFF). |
| `health field is required` (400) | Body isn't your Text. Get Contents of URL → **Request Body = File**, with the **Text** as the file; Text action directly above. |
| "trying to share N health items, not allowed" | Settings → Shortcuts → Advanced → **Allow Sharing Large Amounts of Data** = ON. |
| "Allow … to send health data to truemirror.paahulhq.com?" | Tap **Always Allow** — expected (iOS tags health-derived data; we only send computed numbers). If you tap Don't Allow it blocks the domain; reset via the shortcut's **ⓘ → Privacy**. |
| A daily array looks wrong | Quick Look the `…Daily` variable mid-build; check the loop's date formatting (`yyyy-MM-dd`) and value key. |
| Want to inspect the body | Temporarily add **Quick Look** of the **Text** before Get Contents of URL. |

## Verifying server-side

After a run, open `https://truemirror.paahulhq.com/history?token=‹yourtoken›` — the new
report should show Recovery + Sleep chips (once HRV + sleep are flowing) and, with daily
arrays, the trend charts populate across runs **and the "Since your last full day" card
appears above the analysis** (it needs ≥3 days in at least one daily array).

Quick check without re-running the Shortcut: `GET /api/history?token=…` returns a
`day_over_day` field per report — if it's `null`, no daily arrays reached the server yet.
