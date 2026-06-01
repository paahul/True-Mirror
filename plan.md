# True Mirror — Build Plan

## Overview

iOS Shortcuts reads Apple Health + Fitness data from HealthKit, POSTs it to a Next.js API route, Claude analyses it and returns honest insights, results stored per user in Supabase (opt-in). Users install by tapping a shared Shortcut link posted to a group — no individual links, no manual provisioning. No App Store. No XML export.

---

## Milestones (current priority order)

1. ✅ **Backend** — deployed to truemirror.paahulhq.com, verified end-to-end
2. ⏳ **iOS Shortcut** — HealthKit → JSON → POST → show analysis (THIS IS NEXT)
3. ✅ **History UI** — `/history` page with trend charts + toggles
4. ⏳ **UI tuning** — polish the report page + history page once there's real usage (lots to refine; deferred on purpose)
5. ⏳ **Email reminders** — wire up Resend for charge/wear nudges (needs Vercel Pro for hourly cron)

(The "Phase" sections below predate this ordering; phases map roughly to milestones but UI tuning was split out as its own milestone on 2026-05-31.)

---

## Stack

- **Next.js on Vercel** — API routes + history UI + shareable report pages
- **Supabase** — users + reports tables
- **Claude API** — analysis (claude-opus-4-8)
- **iOS Shortcuts** — HealthKit data pipeline, shareable via icloud.com/shortcuts link
- **Resend** — transactional email for reminders (not yet wired up)

---

## User modes

Three modes, selected at registration, stored on the user row, changes the Claude prompt:

| Mode | Persona | Primary questions |
|---|---|---|
| `curious` (default) | Wears a Watch, generally health-conscious | Am I moving enough? Is my sleep working? Is stress showing up? |
| `active` | Trying to build movement habits, non-gym | Am I less sedentary? Are my habits improving? |
| `performance` | Trains seriously, wants to optimise | Am I recovered? Should I push today? What's my fitness trend? |

Mode is set once at registration. Changeable later via history page. Implementation: `mode` column on users, three system prompts in `lib/claude.ts`, swap based on mode. **Not yet implemented — prompt currently uses one general prompt. Add per-mode prompts as Phase 1g.**

---

## How distribution works

Post one Shortcut link to a group. Everyone installs it. First run: Shortcut asks name, optional email, mode preference, reminder preferences — registers via `/api/register` — stores token in iCloud Drive. Every subsequent run is silent. Access gated by an invite code embedded in the Shortcut.

---

## Phase 1 — Backend ✅ (code complete, not yet deployed)

### 1a. Supabase schema ✅
- `users`: id, name, token, email, mode, opt_in, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at
- `reports`: id, user_id, raw_data (jsonb), analysis, created_at

### 1b. POST /api/register ✅
- Invite code gate (INVITE_CODE env var)
- Accepts: name, email, mode, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at
- Returns: token

### 1c. POST /api/analyze?token=... ✅
- Token lookup → 401 if not found
- Calls Claude with health summary + computed scores
- Saves raw_data + analysis to reports (if opt_in)
- Returns: token, analysis, report_id, share_url

### 1d. Computed scores (lib/scores.ts) ✅
Server-side before Claude sees the data:
- **Sleep score** (0–100): weighted stages — duration 40pts, deep 30pts, REM 20pts, efficiency 10pts
- **Recovery score** (0–100): Altini/HRV4Training — recent HRV vs 30-day baseline (60pts), RHR deviation (20pts), sleep (20pts)
- **Strain score** (0–100): Banister TRIMP when per-workout HR available; calorie/exercise approximation otherwise
- **Stress level** (low/moderate/high): HRV suppression unexplained by training load

Scores passed to Claude as a summary line. Claude uses them as orientation, grounds analysis in raw data.

### 1e. GET /report/[id] ✅
Public shareable page. Shows analysis + date + "Get True Mirror" CTA. Security through UUID obscurity. This is the referral loop — someone shares their analysis, others tap the CTA.

### 1f. GET /api/cron/nudge ✅ (stub — email not wired)
Vercel Cron, runs hourly. Finds users whose local reminder time matches current hour. Sends charge or wear reminders via email. **Needs Resend wired up.**

### 1g. Per-mode Claude prompts ⏳
Three system prompts based on user.mode. Currently one general prompt handles all users.

### 1h. Data gap detection ⏳
If daily data has gaps (Watch not worn), Claude flags it and coaches on charging habit. Add to prompt: detect missing days in daily arrays, include gap count in summary.

---

## Phase 2 — iOS Shortcut ⏳

### Registration flow (first run only)
1. Try to read token from iCloud Drive (`/Shortcuts/TrueMirror/token.txt`)
2. If missing:
   - Ask "What's your name?"
   - Ask "Email for reminders? (optional)"
   - Ask "How do you use your Watch?" → menu: Just curious / Building active habits / Serious training
   - Ask "Charge reminder? What time?" (optional)
   - Ask "Wear reminder? What time?" (optional)
   - Get current timezone (Shortcuts action: "Get Current Time Zone")
   - POST to `/api/register` with all fields + hardcoded invite_code
   - Save token to iCloud Drive

### Analysis flow (every run)
1. Read token from iCloud Drive
2. Pull health metrics from HealthKit (see metric list below)
3. Build JSON payload
4. POST to `/api/analyze?token=[token]`
5. Show analysis (Quick Look or Show Result)
6. Ask "Share this analysis?" → share sheet with share_url from response

### Metrics to pull

| Metric | HealthKit action | Notes |
|---|---|---|
| Steps | Find Health Samples → Step Count | Sum per day |
| Sleep | Find Health Samples → Sleep Analysis | Split by stage: Asleep, AsleepDeep, AsleepREM, Awake |
| Resting HR | Find Health Samples → Resting Heart Rate | One value per day |
| HRV | Find Health Samples → Heart Rate Variability | One value per day |
| VO2 max | Find Health Samples → VO2 Max | Most recent value |
| Respiratory rate | Find Health Samples → Respiratory Rate | During sleep, one per day |
| Blood oxygen | Find Health Samples → Blood Oxygen | During sleep, one per day |
| Active energy | Find Health Samples → Active Energy Burned | Sum per day |
| Exercise minutes | Find Health Samples → Exercise Time | Sum per day |
| Workouts | Find Workouts | Last 30 days, include avg HR per workout |
| Weight | Find Health Samples → Body Mass | Most recent + first in period for change_30d |
| Stand hours | Find Health Samples → Apple Stand Hour | Count Stood per day |
| Age | Date of Birth | For max HR estimation in TRIMP |
| Timezone | Get Current Time Zone | Sent at registration |

Sleep stages are the hardest part — iOS stores them as overlapping intervals. Calculate minutes per stage manually.

---

## Phase 3 — History UI ✅ (deployed 2026-05-31)

Page at `/history?token=[token]` — client component, fetches `GET /api/history?token=`:
- ✅ Reports newest first with date + score chips (Recovery/Sleep/Strain/Stress)
- ✅ Score trend charts (Recovery, Sleep over time) — dependency-free inline SVG, fixed 0–100 scale
- ✅ Full analysis expandable on tap (reuses the report page's bold-header renderer)
- ✅ Share per report (Open ↗ link + Copy link)
- ✅ Mode toggle and opt-out toggle → `PATCH /api/user?token=` (optimistic update)

Scores are **not persisted** — `GET /api/history` recomputes them from each report's stored `raw_data` via `computeScores()`. `HealthScores` type moved to `lib/types.ts` (single source) to avoid a circular import.

New files: `app/history/page.tsx`, `app/history/HistoryClient.tsx`, `app/api/history/route.ts`, `app/api/user/route.ts`. New supabase helpers: `getReportsByUser`, `updateUser`.

---

## Phase 4 — Email ⏳

Wire up Resend:
- `npm install resend`
- Add `RESEND_API_KEY` to Vercel env
- Uncomment `sendEmail()` in `/api/cron/nudge/route.ts`
- Add weekly summary email (separate cron or same route)
- Add `CRON_SECRET` to Vercel env (Vercel sets this automatically for cron auth)
- **Cron schedule**: currently `0 13 * * *` (daily) in `vercel.json` because the Hobby plan caps crons at once/day. The nudge route matches each user's reminder hour against the current hour, so it needs to run **hourly** (`0 * * * *`) to cover all timezones. Revert to hourly once on Vercel Pro — required for the reminder feature to actually work per-timezone.

---

## UX decisions — held open

- **Scores vs narrative vs combination**: not decided. Depends on who the first real users are and what questions they're actually asking. Run it on real people first.
- **Verdict line**: considered a one-line status at top of analysis ("Not recovered. Don't push today.") but too athlete-centric for general persona. Revisit after first user feedback.
- **Report page design**: currently minimal. May need iteration once shared in the wild.

---

## Build order

1. ✅ Full backend (schema, register, analyze, scores, report page, cron stub)
2. ⏳ **Deploy**: Supabase project → run migration → Vercel deploy → set env vars → DNS
3. ✅ **Smoke test**: `curl -X POST https://truemirror.paahulhq.com/api/analyze?token=... -d @fixtures/health-data.json`
4. ⏳ **Build Shortcut**: registration flow + analysis flow + share action
5. ⏳ **Test on iPhone**: run against real Health data, iterate on prompt
6. ⏳ **Wire email**: add Resend, test charge/wear reminders
7. ✅ **Build history UI**
8. ⏳ **Per-mode prompts**
9. ⏳ **Data gap detection in prompt**

---

## Environment variables

| Var | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel | Claude API key |
| `SUPABASE_URL` | Vercel | Project URL from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Service role key (not anon key) |
| `NEXT_PUBLIC_BASE_URL` | Vercel | `https://truemirror.paahulhq.com` |
| `INVITE_CODE` | Vercel | Gate for self-serve registration |
| `RESEND_API_KEY` | Vercel | When email is wired up |
| `CRON_SECRET` | Vercel | Auto-set by Vercel for cron auth |

---

## Open questions

- Rate limiting: one analysis per user per day?
- Opt-out UX: toggle on history page is the plan
- Second group invite: duplicate Shortcut with new INVITE_CODE, or build invite management?
- Referral attribution: carry `ref=[report_id]` through to registration to track which shared reports drive signups?
