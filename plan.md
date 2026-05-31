# True Mirror — Build Plan

## Overview

iOS Shortcuts reads Apple Health + Fitness data from HealthKit, POSTs it to a Next.js API route, Claude analyses it and returns honest insights, results are stored per user in Supabase (opt-in). Users install by tapping a shared Shortcut link. No App Store. No XML export.

---

## Stack

- **Next.js on Vercel** — API route + history UI
- **Supabase** — users + reports tables
- **Claude API** — analysis and suggestions
- **iOS Shortcuts** — HealthKit data pipeline, shareable via icloud.com/shortcuts link

---

## Phase 1 — Backend (no iPhone needed)

### 1a. Supabase schema

**users**
```
id          uuid primary key default gen_random_uuid()
name        text not null
token       text unique not null  -- generated on signup, embedded in their Shortcut
opt_in      boolean default true  -- history opt-in, changeable anytime
created_at  timestamptz default now()
```

**reports**
```
id          uuid primary key default gen_random_uuid()
user_id     uuid references users(id)
created_at  timestamptz default now()
raw_data    jsonb        -- the health metrics as received from Shortcut
analysis    text         -- Claude's response
```

Token-based identity: each user gets a unique token you generate and embed in their Shortcut URL. No login, no password. They POST to `/api/analyze?token=abc123`. Simple enough for friends/family, you control who has access.

### 1b. API route — POST /api/analyze

Steps:
1. Read `token` from query param, look up user in Supabase
2. Return 401 if token not found
3. Parse health JSON from request body
4. Build Claude prompt (see 1c)
5. Call Claude API, get analysis back
6. If user.opt_in, save raw_data + analysis to reports table
7. Return analysis as JSON

### 1c. Claude prompt design

The prompt is the most important part. Key principles:
- Be honest, not relentlessly positive
- Identify real patterns, not just restate numbers
- Give 2-3 specific, actionable suggestions — not generic wellness advice
- Flag anything that warrants attention (e.g. HRV dropping week over week)
- Keep the tone like a smart, direct friend — not a doctor, not a wellness app

Prompt structure:
```
You are a health analyst reviewing [name]'s Apple Health data from the last 30 days.

[Structured health data here]

Give an honest, direct analysis. Cover:
1. What's going well (be specific, not generic)
2. What needs attention — patterns, trends, anything declining
3. Two or three concrete suggestions they can act on this week

Do not give medical advice. Do not use wellness platitudes.
If something looks genuinely concerning, say so plainly and suggest they
talk to a doctor — don't soften it into nothing.
```

### 1d. Health data JSON structure (what the Shortcut sends)

```json
{
  "period_days": 30,
  "activity": {
    "avg_daily_steps": 8200,
    "avg_active_calories": 480,
    "avg_exercise_minutes": 32,
    "avg_stand_hours": 10
  },
  "heart": {
    "avg_resting_hr": 58,
    "avg_hrv": 42,
    "vo2_max": 41.2
  },
  "sleep": {
    "avg_total_minutes": 412,
    "avg_deep_minutes": 68,
    "avg_rem_minutes": 94,
    "avg_awake_minutes": 22
  },
  "workouts": {
    "total_count": 14,
    "types": ["Running", "HIIT", "Yoga"],
    "avg_duration_minutes": 38,
    "avg_calories": 310
  },
  "body": {
    "weight_kg": 78.2,
    "weight_trend": "stable"
  }
}
```

Not every user will have every field — design the prompt and route to handle missing data gracefully.

---

## Phase 2 — iOS Shortcut

This phase requires an iPhone with real Health data to test properly.

### Metrics to pull and how

Shortcuts HealthKit actions to use:
- **Steps** — Find Health Samples where type is Steps, last 30 days, aggregate average
- **Active Energy** — same pattern
- **Exercise Minutes** — same
- **Stand Hours** — same
- **Resting Heart Rate** — Find Health Samples, last 30 days
- **Heart Rate Variability** — Find Health Samples (HRV), last 30 days
- **VO2 Max** — Find Health Samples
- **Sleep Analysis** — Find Health Samples where type is Sleep Analysis, last 30 days (need to split by stage: InBed, Asleep, AsleepDeep, AsleepREM — iOS 16+)
- **Workouts** — Find Workouts, last 30 days (gives type, duration, calories, distance)
- **Body Mass** — Find Health Samples, most recent

### Shortcut flow

1. Show "Fetching your health data..." notification
2. Pull each metric category (chained actions)
3. Build JSON dictionary from results
4. Get Contents of URL → POST to `https://your-domain.com/api/analyze?token=[token]`
5. Parse response JSON
6. Show analysis in a Quick Look / Show Result action

Sleep stages are the trickiest part — iOS represents sleep as overlapping time intervals by stage, not simple averages. May need to calculate total minutes per stage manually in the Shortcut or do it server-side from raw intervals.

### Sharing

Once working, export as `.shortcut` file and share via icloud.com/shortcuts link. Each user gets the same Shortcut but with their own token hardcoded in the URL. To onboard a new person: generate their token in Supabase, edit the Shortcut URL, re-export, send.

**Better long-term:** Shortcut asks for token on first run and stores it in a local variable. Then you just share one Shortcut link and send each person their token separately.

---

## Phase 3 — History UI

Simple Next.js page at `/history?token=[token]`:
- Fetches reports for that user from Supabase
- Lists them newest first with date
- Clicking one shows the full analysis
- Shows opt-in/out toggle (PATCH to `/api/user/opt-in`)

No login screen — token in URL is the identity. Fine for friends/family. Not fine for strangers.

---

## Phase 4 — Prompt tuning

The prompt will need iteration with real data. Known things to tune for:
- Handling sparse data (new Apple Watch users, people who don't track sleep)
- Handling outlier weeks (illness, travel, unusual activity)
- Getting the tone right — honest without being alarming, specific without being medical
- Adding week-over-week comparison once history is populated (Phase 3 required)

Worth building a test harness: a few JSON fixture files representing different user profiles (active, sedentary, poor sleep, great metrics) so the prompt can be tested without running the Shortcut each time.

---

## Build order

1. Supabase schema + seed a test user with a token
2. POST /api/analyze route with hardcoded test JSON → confirm Claude response
3. Tune prompt with fixture data until analysis quality feels right
4. Hook up Supabase reads/writes (token lookup, report save)
5. Build the Shortcut, test on iPhone with real data
6. Iterate on Shortcut until all metrics come through correctly
7. Build history UI
8. Onboard first user (yourself), then friends

---

## Open questions before building

- **Domain**: truemirror.paahulhq.com — subdomain on existing personal domain, no separate registration needed. Add DNS record in Vercel, point to new True Mirror project. Same pattern as any future cadence.paahulhq.com / tripsmith.paahulhq.com.
- **Opt-out UX**: how does a user toggle history off? URL param? A simple page?
- **Token generation**: manual (you generate in Supabase) or self-serve signup page?
- **Rate limiting**: one analysis per user per day to keep Claude costs predictable?
- **Metrics scope v1**: start with the 5-6 most universal metrics (steps, sleep, resting HR, workouts) and expand, rather than trying to pull everything at once in the Shortcut
