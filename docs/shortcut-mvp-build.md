# MVP Shortcut — Build Guide (Phase 2, step 1)

Goal: prove the whole pipeline end-to-end on a real iPhone —
**HealthKit → build JSON → POST to the API → show Claude's analysis** —
with the fewest moving parts. No per-day arrays yet (those come in the enrich step).

## MVP scope

Four metrics, all simple numeric health samples (no sleep stages, no loops):

| Field sent | HealthKit sample | How we compute it |
|---|---|---|
| `steps.total` | Step Count | Sum over 30 days |
| `steps.average` | Step Count | Sum ÷ 30 |
| `heart_rate.resting_average` | Resting Heart Rate | Average (Watch writes ~1/day) |
| `active_energy.average` | Active Energy | Sum ÷ 30 |
| `exercise_minutes.average` | Apple Exercise Time | Sum ÷ 30 |

This is enough for Claude to produce a real analysis (Strain score computes from
energy/exercise; Sleep/Recovery will be null until we add sleep + HRV).

## Constants

- **POST URL:** `https://truemirror.paahulhq.com/api/analyze?token=3083b194-a2ab-4035-ac41-6af4a3985e55`
  (token = Paahul's user; it's in the query string, not the body)

---

## Build steps (iPhone → Shortcuts app → New Shortcut)

Add these actions in order. Search the action by name in the bottom search bar.

### 1. Steps — total
1. **Find Health Samples**
   - Sample type: **Step Count**
   - Tap **Add Filter** → **Start Date** → **is in the last** → **30** **Days**
2. **Calculate Statistics**
   - Operation: **Sum** · Input: *Health Samples* (auto from step 1)
3. **Set Variable** → name it `StepsTotal`

### 2. Steps — daily average
4. **Calculate** (math action)
   - `StepsTotal ÷ 30`
5. **Round Number** → round *Calculation Result* to nearest **1**
6. **Set Variable** → `StepsAvg`

### 3. Resting heart rate — average
7. **Find Health Samples** → **Resting Heart Rate** → filter **Start Date is in the last 30 Days**
8. **Calculate Statistics** → **Average**
9. **Round Number** → nearest **1**
10. **Set Variable** → `RHRAvg`

### 4. Active energy — daily average
11. **Find Health Samples** → **Active Energy** → filter last **30 Days**
12. **Calculate Statistics** → **Sum**
13. **Calculate** → `÷ 30`
14. **Round Number** → nearest **1**
15. **Set Variable** → `EnergyAvg`

### 5. Exercise minutes — daily average
16. **Find Health Samples** → **Apple Exercise Time** → filter last **30 Days**
17. **Calculate Statistics** → **Sum**
18. **Calculate** → `÷ 30`
19. **Round Number** → nearest **1**
20. **Set Variable** → `ExAvg`

### 6. Build the JSON body
21. **Text** — paste this exactly, then replace each `‹Var›` by tapping where it goes,
    choosing **Select Variable**, and picking the matching variable:

```
{
  "save_history": true,
  "health": {
    "period_days": 30,
    "steps": { "average": ‹StepsAvg›, "total": ‹StepsTotal› },
    "heart_rate": { "resting_average": ‹RHRAvg› },
    "active_energy": { "average": ‹EnergyAvg› },
    "exercise_minutes": { "average": ‹ExAvg› }
  }
}
```

The `‹StepsAvg›` etc. become blue variable chips. Everything else is literal text.
Numbers must NOT be wrapped in quotes.

### 7. POST to the API
22. **Get Contents of URL**
    - URL: `https://truemirror.paahulhq.com/api/analyze?token=3083b194-a2ab-4035-ac41-6af4a3985e55`
    - Tap to expand options:
      - **Method:** POST
      - **Headers:** add `Content-Type` = `application/json`
      - **Request Body:** **File** (this sends the Text from step 21 as the raw body)
    - Make sure the **Text** action (step 21) is immediately above this action so its
      output is the input.

### 8. Show the analysis
23. **Get Dictionary Value**
    - Get **Value** for key `analysis` in *Contents of URL*
24. **Show Result** (or **Quick Look**) → show *Dictionary Value*

---

## Run it

- First run: iOS prompts for **Health read access** — allow each requested type.
- After ~10 seconds you should see Claude's three-section analysis.
- It's also saved to your history (you can open `/history?token=…` and see it).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401 Invalid token` | URL token wrong — re-check the `?token=` value |
| `400 health field is required` or `Invalid JSON` | Body isn't being sent as raw JSON. Set **Request Body = File** and confirm the **Text** action feeds directly into **Get Contents of URL**. Check the Text has no smart-quotes (use plain `"`). |
| A number shows as blank → JSON breaks | That metric had no samples. For MVP, pick metrics you have data for; we'll add empty-guards in the enrich step. |
| `500` | Server error — copy the response and tell Claude; likely a malformed number (e.g., comma in a value). |
| Want to see the raw body | Temporarily add a **Show Result** right after the **Text** action to inspect the JSON before POSTing. |

## Next (after this works)

- Add **sleep** (hours asleep) and **HRV** → unlocks more of the analysis.
- Add **per-day arrays** (Repeat over 30 days) → unlocks the **Recovery** score and trend charts.
- Add **workouts** and **VO2 max**.
- Swap the hardcoded token for the **first-run registration flow** so the Shortcut is shareable.
