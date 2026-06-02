# Build Your Own True Mirror

True Mirror is a **personal tool**, not an App Store product. There's no frictionless "install"
— but if you're willing to deploy a small backend and assemble one iOS Shortcut, you'll have
your own private, honest health analyzer. This is the complete, end-to-end guide.

**Two parts:** (1) deploy the backend (~20 min, once), (2) build the iOS Shortcut (~30–45 min,
once). Then it's a tap to run forever.

> Honest expectation-setting: the iOS side has unavoidable friction — per-data-type Health
> permission, a "share large data" toggle, and (for Apple Watch users) a per-device source
> filter. That's the iOS tax for any HealthKit tool. Fine for yourself or a motivated friend;
> not something a non-technical person will breeze through. See "Known gotchas" at the end.

---

## Part 1 — Deploy the backend

You need free-tier accounts at **Anthropic**, **Supabase**, and **Vercel**.

1. **Clone + install:**
   ```bash
   git clone https://github.com/paahul/True-Mirror.git
   cd True-Mirror
   npm install
   ```
2. **Supabase:** create a project → SQL Editor → paste & run `supabase/migrations/001_initial.sql`
   (creates `users` + `reports`). Grab your **Project URL** and **service-role key** (Settings → API).
3. **Vercel:** `npm i -g vercel`, then `vercel link` (lowercase project name) and set env vars
   (Production):

   | Var | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Claude API key |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key (not anon) |
   | `NEXT_PUBLIC_BASE_URL` | your deploy URL (or custom domain) |
   | `INVITE_CODE` | any value (only used by the unused registration path) |

   Then `vercel deploy --prod`.
4. *(Optional)* **Custom domain:** add it in Vercel; if using Cloudflare, set an `A` record to
   `76.76.21.21` with proxy **OFF** (grey cloud) or Vercel's SSL breaks (HTTP 525).

Smoke-test without a Shortcut:
```bash
# create a user, copy its token:
#   in Supabase SQL editor:  insert into users (name) values ('You') returning token;
curl -X POST "https://YOUR_URL/api/analyze?token=THE_TOKEN" \
  -H "Content-Type: application/json" -d @fixtures/health-data.json
```
You should get a JSON analysis back.

---

## Part 2 — Provision yourself a user

Each person = one row in `users`, identified by a token hardcoded into their Shortcut.
```sql
insert into users (name, mode) values ('Your Name', 'curious') returning token;
```
`mode` is `curious` | `active` | `performance` (changes the Claude prompt emphasis; changeable
later on the history page). Keep the returned **token** — it goes in the Shortcut URLs.

---

## Part 3 — Build the iOS Shortcut

This reads HealthKit, sends a compact summary to your API, and opens your analysis. Full
action-by-action steps are in **[`shortcut-mvp-build.md`](shortcut-mvp-build.md)** (the core
4 metrics) and **[`shortcut-enrichment-build.md`](shortcut-enrichment-build.md)** (the rest).
The shape of the finished Shortcut:

**A. For each metric — `Find Health Samples → Calculate Statistics → Round → Set Variable`:**

| Variable | Metric | Stat | Notes |
|---|---|---|---|
| `StepsTotal`, `StepsAvg` | Step Count | Sum (+ ÷30 for avg) | |
| `RHRAvg` | Resting Heart Rate | Average | |
| `EnergyAvg` | Active Energy | Sum ÷30 | |
| `ExAvg` | Exercise/Apple Exercise Time | Sum ÷30 | |
| `HRVAvg` | Heart Rate Variability | Average | 30-day baseline |
| `HRVRecent` | Heart Rate Variability (last **7** days) | Average | drives Recovery/Stress |
| `RespAvg` | Respiratory Rate | Average | |
| `SpO2Avg` | Blood Oxygen | Average (×100 if it reads like 0.97) | |
| `VO2` | Cardio Fitness (VO₂ max) | most-recent (Sort Latest, Limit 1 → Avg) | |
| `WeightLatest`, `WeightDelta` | Weight | latest + (latest − earliest) | |

> 🔑 **Two non-obvious must-dos (learned the hard way):**
> - **Set `Group by: Day` on every 30-day `Find`.** Dense metrics (Active Energy especially)
>   otherwise sum thousands of raw samples and **crash the Shortcut** on data-rich phones.
>   Grouping → ~30 values → fast, same result.
> - **Apple Watch users: add `Add Filter → Source → <your Watch>`** on Steps / Active Energy /
>   Exercise, or iPhone + Watch **double-count** (~2× steps). This is device-specific, so each
>   person sets their own. Phone-only users skip it.

**B. Send it — `Get Contents of URL`:**
- URL: `https://YOUR_URL/api/analyze?token=YOUR_TOKEN`
- Method **POST**, **Request Body = JSON**
- Add a field per metric (type **Text**, value = the variable — the server coerces text→number),
  plus `save_history` (Boolean, `true`). Keys: `steps_avg, steps_total, rhr_avg, energy_avg,
  exercise_avg, hrv_avg, hrv_recent, resp_avg, spo2_avg, vo2, weight_latest, weight_change`.
  Only include what you built — **missing metrics are fine**, the server tolerates any subset.

**C. Show it:**
- `Get Dictionary Value` → key `analysis`  → `Show Result`
- `Open URLs` → `https://YOUR_URL/history?token=YOUR_TOKEN` (lands you on your persistent page)

---

## Part 4 — Run & use it

1. **Settings → Shortcuts → Advanced → Allow Sharing Large Amounts of Data = ON** (before first run).
2. Run the Shortcut. On the Health sheet tap **Turn On All**. On "send health data to <your
   domain>" tap **Always Allow**.
3. ~20s later your **history page** opens with the analysis. **Add it to your Home Screen** for
   an app-like icon. Tap anytime to refresh; trends build up across runs.

---

## Known gotchas (all real, all hit in testing)

| Symptom | Cause / fix |
|---|---|
| "There was a problem running" at the data steps, data-rich phone | Dense metric summed raw → **Group by: Day** on the Find. |
| Steps/energy ~2× too high | iPhone+Watch double-count → **Source filter → your Watch**. |
| "...large amounts of data" error | Enable **Allow Sharing Large Amounts of Data** (Settings → Shortcuts → Advanced). |
| Fails at `Get Contents of URL`, nothing reaches server | The "send health data to domain" prompt was declined → delete + re-add the Shortcut, **Always Allow**. |
| Analysis says "not enough data" | You have few metrics / a no-Watch phone — expected; it won't fabricate. |
| Invalid JSON (manual builds) | Use the JSON request-body builder (not a typed Text block) to avoid smart-quote/comma errors. |

See [`learnings.md`](learnings.md) for the full backstory on each.
