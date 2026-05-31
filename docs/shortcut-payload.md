# Shortcut Payload Spec

The iOS Shortcut POSTs this JSON to `POST /api/analyze`. This doc is the contract
between the Shortcut and the API — build both sides against it.

## Full payload shape

```json
{
  "token": "string or null",
  "save_history": true,
  "health": {
    "period_days": 30,
    "steps": {
      "daily": [{ "date": "YYYY-MM-DD", "count": 9234 }],
      "average": 7843,
      "total": 235290
    },
    "sleep": {
      "daily": [{ "date": "YYYY-MM-DD", "hours_asleep": 6.4, "hours_in_bed": 7.8 }],
      "average_hours_asleep": 6.4,
      "average_hours_in_bed": 7.8
    },
    "heart_rate": {
      "resting_average": 68,
      "daily_resting": [{ "date": "YYYY-MM-DD", "bpm": 66 }]
    },
    "hrv_ms": {
      "average": 44,
      "daily": [{ "date": "YYYY-MM-DD", "ms": 52 }]
    },
    "vo2_max_ml_kg_min": 41.2,
    "active_energy": {
      "daily": [{ "date": "YYYY-MM-DD", "kcal": 412 }],
      "average": 412
    },
    "exercise_minutes": {
      "daily": [{ "date": "YYYY-MM-DD", "minutes": 32 }],
      "average": 22
    },
    "workouts": [
      {
        "date": "YYYY-MM-DD",
        "type": "Running",
        "duration_minutes": 42,
        "calories": 390,
        "distance_km": 6.1
      }
    ],
    "stand_hours": { "daily_average": 9 },
    "weight_kg": { "latest": 82.4, "change_30d": -0.8 }
  }
}
```

Everything inside `health` is optional — send what you have. The API handles missing fields
gracefully; Claude skips metrics it doesn't have data for.

## Token

The Shortcut stores the token it receives from the first API response in a local variable
(or iCloud via Shortcuts' built-in storage). On subsequent runs it reads and includes that
token. This gives the user continuity across analyses without an account.

- First run: omit `token` (or send `null`) → API creates a new token, returns it
- All later runs: include the stored `token` → API looks up the existing user

## HealthKit actions → fields

| Payload field | HealthKit action | Notes |
|---|---|---|
| `steps.daily` | Find Health Samples → Step Count | Group by day, sum per day |
| `sleep.daily` | Find Health Samples → Sleep Analysis | Filter `value = Asleep`, sum duration per night |
| `heart_rate.daily_resting` | Find Health Samples → Resting Heart Rate | One value per day (Watch writes it ~morning) |
| `hrv_ms.daily` | Find Health Samples → Heart Rate Variability | One value per day |
| `vo2_max_ml_kg_min` | Find Health Samples → VO2 Max | Take the most recent value |
| `active_energy.daily` | Find Health Samples → Active Energy Burned | Sum per day |
| `exercise_minutes.daily` | Find Health Samples → Exercise Time | Sum per day |
| `workouts` | Find Workouts | Last 30 days, all types |
| `stand_hours.daily_average` | Find Health Samples → Apple Stand Hour | Count `value = Stood` per day, average |
| `weight_kg` | Find Health Samples → Body Mass | Most recent value; subtract first value in period for `change_30d` |

## Computing averages in the Shortcut

Use the **Calculate Statistics** action on the list of daily values:

- Set **Statistic** to `Average` → feeds into `average` / `resting_average` fields
- Set **Statistic** to `Sum` → feeds into `total` fields

Run Calculate Statistics twice per metric (once for average, once for sum) where both are needed.

## Date format

All dates are `YYYY-MM-DD` local time (no timezone suffix). The API treats them as calendar
dates, not timestamps. iOS `Date` formatted with `"yyyy-MM-dd"` format string.

## What the Shortcut does with the response

```json
{
  "token": "abc123...",
  "analysis": "**What's working**\n...",
  "report_id": "uuid",
  "created_at": "2026-05-31T..."
}
```

1. Store `token` in Shortcuts storage (first run only, or always overwrite — same value)
2. Display `analysis` using **Show Result** or a **Quick Look** action
3. Optionally show `report_id` as a reference

## Minimum viable Shortcut (MVP metrics)

For an initial version, these five fields give Claude enough to produce a useful analysis:

1. `steps` — daily counts + average
2. `sleep` — daily hours asleep + average
3. `heart_rate` — resting average + daily values
4. `exercise_minutes` — daily minutes + average
5. `workouts` — last 30 days

HRV and VO2 max require Apple Watch. Add them if available; the API handles their absence.
