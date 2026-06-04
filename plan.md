# True Mirror — Build Plan

## Overview

iOS Shortcuts reads Apple Health + Fitness data from HealthKit, POSTs it to a Next.js API route, Claude analyses it and returns honest insights, results stored per user in Supabase (opt-in). Users install by tapping a shared Shortcut link posted to a group — no individual links, no manual provisioning. No App Store. No XML export.

---

## Positioning (decided 2026-06-02)

**True Mirror is a personal tool, not a broad-distribution product.** After validating on two
real friends, the conclusion is that the iOS-Shortcut + HealthKit route trades App Store reach
for per-device setup friction (permission gauntlet, Watch source-filter, manual provisioning)
that no polish removes — and even a registration flow wouldn't fix it. So: make it solid for
yourself + a motivated few, and keep the build docs airtight for anyone who wants their own.
Authoritative guide: `docs/build-your-own.md`.

## Milestones

1. ✅ **Backend** — deployed to truemirror.paahulhq.com, verified end-to-end.
2. ✅ **iOS Shortcut (full metric capture, manual token)** — working on real phones with steps,
   RHR, energy, exercise, HRV (avg + recent), VO2, respiratory, SpO2, weight → real
   Recovery/Strain/Stress. Flat JSON body; **fat Shortcut** (`docs/architecture-thin-shortcut.md`).
   *Optional remaining:* Sleep (unlocks the Sleep score) — fiddly, not done.
3. ✅ **History UI** — `/history` with trend charts + toggles.
3.5. ✅ **Harden for missing metrics** — server tolerates any subset (`lib/normalize.ts`),
   coerces string→number, drops empties. Recovery/Stress from `hrv_recent` vs `hrv_avg`.
4. ✅ **Onboard first friends (manual)** — validated end-to-end on two real phones (sparse +
   dense data). Surfaced + fixed: dense-data crash (Group by Day), step double-count (Watch
   source filter), send-permission gotcha. See `docs/learnings.md`.
5. ❌ **Registration flow** — **dropped.** Doesn't remove the real friction; manual provisioning
   is fine at personal scale. (`docs/shortcut-registration-build.md` kept for reference only.)
6. ✅ **UI polish — Shipped (2026-06-02).** Brand-cohesive redesign across landing, history, and
   report pages: history hero with a **dark glowing ring-gauge panel** (count-up numbers,
   Δ-vs-last-run), gradient trend charts, polished report page. Stayed in the "polish what we
   have" lane — not the Whoop dashboard (that's M7).
7. 🟡 **Richer "Whoop-style" charts — DECISION FORK.** Abhishek asked for Whoop-style
   visuals. Before building, decide the direction — they're genuinely different products:

   - ✅ **(a) Deepen the narrative** *(on-brand — SHIPPED 2026-06-03):* day-over-day signal now
     surfaced. The two most recent **completed** days are diffed server-side (`lib/dayOverDay.ts`),
     fed to Claude as an acute "react, don't recite" block, AND rendered as a distinct
     **"Since your last full day"** card (deterministic readiness-led headline + delta pills) above
     the narrative on `/report/[id]` + `/history`. No Shortcut change needed (the daily arrays
     already arrive); idempotent across same-day reruns + the midnight boundary. Recomputed from
     `raw_data` on read like scores — no DB migration. (b) below still open.
   - **(b) Whoop-style dashboard** *(off the moat):* recovery rings, strain curves, sleep-stage
     bars. Needs rich per-day capture (sleep stages, daily arrays) — which means the Group-by-Day
     **Repeat loops** we deliberately removed.

   **Framing for the decision:**
   - We're **free and staying free** — we are *not* competing with Whoop/Oura ($-paid, native
     sensors, polished UI). Trying to out-visual them is a fight on their home field; being a
     *free, honest read* is the niche. The narrative is the moat, not the charts.
   - **Likely structure: a separate "daily snapshot" Shortcut** for the dashboard direction, so
     the per-day capture + loop friction lives in an optional artifact and the **core narrative
     Shortcut stays lean and buildable**. Don't bolt the dashboard onto the main shortcut.
   - Default lean: **(a)** — deepen the narrative; only do **(b)** if there's real pull for it.
8. ⏸️ **Email reminders** — deferred (Resend + hourly cron → Vercel Pro).
9. 🔬 **Research: dynamic "pick your wearable" source filter** — prove/disprove. The Watch
   Source filter is device-specific, so it can't be pre-set for someone else's phone (and a
   server-captured device name can't be injected into a `Find Health Samples` filter at
   runtime). The only viable path is on-device: a first-run "pick your wearable" step stored
   locally, used as a **dynamic Source filter value** — *if* the Source filter accepts a
   variable / "Ask Each Time". **To verify:** on-device, check whether the Source filter value
   can be a Variable / Ask Each Time, or if a generic "Apple Watch" / device-type option exists
   (vs only specific named devices). If yes → cheap-ish fix for the double-count without per-user
   tweaks (but it re-opens registration-flow-style complexity, so only worth it if pushing wider).
   If no → the manual per-Watch-friend source tweak stays.

Build docs: **`build-your-own.md` (authoritative)** · `shortcut-mvp-build.md` ·
`shortcut-enrichment-build.md` · `friend-install-guide.md` · `architecture-thin-shortcut.md` ·
`learnings.md`.

---

## Backlog — what's next (prioritized, 2026-06-02)

Ordered by value × on-brand-ness × effort. All optional; it's a working personal tool today.

1. ✅ **History-page polish** — **done 2026-06-02** (M6). Brand cohesion + dark glowing ring hero
   + Δ-vs-last-run + gradient charts + animations, across history & report pages.
2. **Add Sleep to the Shortcut** → unlocks the Sleep score (completes the four-score set).
3. **Per-mode Claude prompts + data-gap detection** (old Phase 1g/1h) — distinct prompts per
   mode; detect Watch-not-worn gaps and coach on charging. Narrative-deepening = the moat.
4. **Charts fork** (M7) — decide (a) deepen-narrative vs (b) Whoop-style dashboard as a separate
   "daily snapshot" Shortcut.
5. **Dynamic source-filter research** (M9) — the "pick your wearable" feasibility check.
6. **Email reminders** (M8) — Resend + Vercel Pro.

### Pending — Paahul to do
- **📸 Capture + wire README screenshots.** Shoot the deck on a phone (cover → "needs
  attention" w/ chip → a "this week" card) + the homepage sample. Drop in `docs/screenshots/`
  per [`docs/screenshots/CAPTURE.md`](docs/screenshots/CAPTURE.md), then the README block is ready
  to paste. (A screen-recorded swipe GIF at the top of the README would be the strongest asset.)
- **🔧 Local toolchain:** `brew reinstall node` — Homebrew bumped llhttp and broke node 25.9.0.
- **📲 Wire the Shortcut daily arrays** (`hrv_daily`, `rhr_daily`, …) — lights up day-over-day,
  chip deltas, and trend tiles; makes the homepage sample fully truthful. See
  [`docs/shortcut-enrichment-build.md`](docs/shortcut-enrichment-build.md).

(The "Phase" sections below predate this ordering and map roughly to these milestones.)

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

## Phase 2 — iOS Shortcut 🟡 (MVP working on-device 2026-06-01)

**Done:** MVP Shortcut built on Paahul's iPhone — reads steps/RHR/active energy/exercise
(averages), builds JSON via a Text action, POSTs as a File body to `/api/analyze`, shows
Claude's analysis, saves to history. Proved the HealthKit→JSON→POST→display pipeline +
the iOS permission gauntlet (see learnings in `docs/shortcut-mvp-build.md` troubleshooting).

**Next:** full metric capture (`docs/shortcut-enrichment-build.md`). Architecture decided
2026-06-01 → **fat Shortcut** (an on-device test showed iOS collapses a raw health-sample
list to a single scalar, so server-side raw ingest isn't viable; see
`docs/architecture-thin-shortcut.md`). The registration flow below is **deferred**; first
friend gets onboarded manually (`docs/friend-install-guide.md`).

Key on-device learnings (2026-06-01): action labels differ slightly ("Steps", "Exercise
Minutes"); each numbered step is a separate stacked action; Request Body must be **File**
with the Text feeding in; iOS needs **Allow Sharing Large Amounts of Data** + **Always
Allow** sending health data to the domain; smart-quotes and empty variables both break JSON.

### Registration flow (first run only) — DEFERRED, see shortcut-registration-build.md
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
2. ✅ **Deploy**: Supabase project → migration → Vercel deploy → env vars → DNS (live at truemirror.paahulhq.com)
3. ✅ **Smoke test**: `curl -X POST https://truemirror.paahulhq.com/api/analyze?token=... -d @fixtures/health-data.json`
4. 🟡 **Build Shortcut**: MVP (4 metrics) working on-device; full capture + analysis/share flow pending
5. 🟡 **Test on iPhone**: MVP run succeeded end-to-end; iterate on prompt as metrics are added
6. ⏳ **Onboard first friend (manual)** — validate real-world install + permissions
7. ✅ **Build history UI**
8. ⏳ **Registration flow** (deferred until after first friend)
9. ⏳ **Wire email**: add Resend, test charge/wear reminders
10. ⏳ **Per-mode prompts**
11. ⏳ **Data gap detection in prompt**

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
