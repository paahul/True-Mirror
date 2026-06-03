# True Mirror — Claude Code Context

## What this is

True Mirror: iOS Shortcut reads Apple Health data → POSTs to Next.js API → Claude gives honest health analysis → saved to Supabase. Users install by tapping a shared link. No App Store, no XML export, no login.

Read `plan.md` and `why.md` for full context before doing anything.

## Current status

**Backend is DEPLOYED and verified in production (2026-05-31).** Live at https://truemirror.paahulhq.com (custom domain, SSL issued). Smoke-tested end-to-end: register → analyze (Claude) → save report → shareable report page all work. DB is empty (test data cleaned up).

Deployment details:
- **Supabase**: project ref `eoakiwolgmelbpfttgmu`, region East US (Ohio), own org "true-mirror". Migration `001_initial.sql` applied (`users` + `reports` tables, RLS on). App uses the service-role key (bypasses RLS) — no anon access path.
- **Vercel**: project `paahul-s-projects/true-mirror`, GitHub repo connected (auto-deploys on push to `main`). All 5 env vars set in Production. Deploy via `vercel deploy --prod` from repo root, or push to `main`.
- **DNS**: `truemirror.paahulhq.com` → `A 76.76.21.21` in Cloudflare, **DNS only (grey cloud)** — must stay grey or Vercel SSL breaks (525).
- **Cron**: on Hobby plan, capped at daily — currently `0 13 * * *`. Revert to hourly (`0 * * * *`) when on Pro + email is wired (see plan.md Phase 4).

## Positioning (decided 2026-06-02)

**Personal tool, not a broad-distribution product.** Validated on two real friends (Aditi,
Abhishek); the iOS-Shortcut route's per-device setup friction (permissions, Watch source-filter,
manual provisioning) doesn't scale and a registration flow wouldn't fix it. So: solid for self +
a few, airtight build docs for the rest. Authoritative guide: `docs/build-your-own.md`.

## iOS Shortcut status (Milestone 2 — WORKING)

Full metric capture working on real phones: steps, RHR, active energy, exercise, HRV (avg +
**recent/7-day**), VO2 (Cardio Fitness), respiratory, SpO2, weight → real Recovery/Strain/Stress.
Sends a **flat JSON body** (Request Body = JSON, Text values; server coerces). Ends with
`Open URLs` → `/history?token=…` so it lands on the user's page. Paahul's token:
`3083b194-a2ab-4035-ac41-6af4a3985e55`. **Architecture: FAT Shortcut** (iOS won't serialize raw
sample lists). Recovery/Stress compute from `hrv_recent` vs `hrv_avg` — **no daily loop**.

Critical build rules (from real failures, see `docs/learnings.md`):
- **`Group by: Day` on every 30-day Find** — or dense metrics (Active Energy) crash the Shortcut.
- **Apple Watch users: Source filter → their Watch** on Steps/Energy/Exercise — or ~2× double-count.
- Server (`lib/normalize.ts`) tolerates **any subset** of metrics (no-Watch/no-weight users are fine).

**Done 2026-06-02:** UI polish (M6) — brand-cohesive redesign across landing/history/report;
history hero = dark glowing ring gauges + count-up + Δ-vs-last-run, gradient trend charts.

**Done 2026-06-03:** Day-over-day acute signal (M7 fork option **a** — narrative-deepening).
`lib/dayOverDay.ts` diffs the two most recent **completed** days (anchors "today" on the
array's max date → idempotent across same-day reruns + midnight). Shown two ways: fed to Claude
as a "react, don't recite" block, and as a distinct **"Since your last full day"** card
(deterministic readiness-led headline + delta pills) above the narrative on `/report/[id]` +
`/history`. Recomputed from `raw_data` on read like scores — no DB migration. Also added
`resp_daily`/`spo2_daily` support to `lib/normalize.ts` (was missing).

> ⚠️ **DATA-DEPENDENT — currently dark on real data.** The production FAT Shortcut sends
> averages only (**no daily loop**), so `computeDayOverDay` returns null → card hidden, and the
> 30-day trend arrows are dark too. **Decision (2026-06-03): add full 30-day daily arrays to the
> Shortcut.** Server is ready; this is Shortcut-side work — see `docs/shortcut-enrichment-build.md`
> "Daily arrays (Pattern D)" for the exact flat `*_daily` keys. Quick check: `GET /api/history`
> → `day_over_day` is `null` until arrays arrive.

**What's next (if/when resumed — currently paused):**
1. **Shortcut: add 30-day daily arrays** (`hrv_daily`, `rhr_daily`, `sleep_daily`, `steps_daily`,
   `energy_daily`, `exercise_daily`, `resp_daily`, `spo2_daily`) → lights up day-over-day card +
   trend arrows. Mind the Group-by-Day crash rule + Watch source filter.
2. **Sleep** metric → unlock the Sleep score (completes the four-score set).
3. **Per-mode prompts + data-gap detection** — narrative-deepening (the moat).
4. **Charts — M7 fork (b) still open:** Whoop-style dashboard (rings/curves — re-opens the
   per-day Repeat loops). We're free, not competing with paid sensor apps, so the narrative is
   the moat; only do (b) if there's real pull. If so, likely a **separate "daily snapshot"
   Shortcut** to keep the core one lean. (Option (a) shipped — see Done 2026-06-03 above.)
5. **Email reminders (M8)** · **dynamic source-filter research (M9)** — deferred.
6. **Registration flow (M5) — DROPPED** (`docs/shortcut-registration-build.md` is reference only).

See `plan.md` "Milestones" for the full ordering.

Smoke-test recipe (no Shortcut needed): insert a user via Supabase SQL editor (`INSERT INTO users (name) VALUES ('Test') RETURNING token;`), then `curl -X POST "https://truemirror.paahulhq.com/api/analyze?token=TOKEN" -H "Content-Type: application/json" -d @fixtures/health-data.json`. Note the fixture has `save_history:false` (stateless); set it true to test the report-save path.

## Env vars needed

```
ANTHROPIC_API_KEY          Claude API key
SUPABASE_URL               From Supabase project dashboard
SUPABASE_SERVICE_ROLE_KEY  Service role key (not anon)
NEXT_PUBLIC_BASE_URL       https://truemirror.paahulhq.com
INVITE_CODE                Whatever you want — embed same value in Shortcut
RESEND_API_KEY             When wiring up email (Phase 4)
CRON_SECRET                Vercel sets this automatically
```

## Key files

```
app/api/analyze/route.ts      POST /api/analyze?token=...  — main endpoint
app/api/register/route.ts     POST /api/register           — self-serve signup
app/api/cron/nudge/route.ts   GET  /api/cron/nudge         — daily email reminders (see plan.md cron note)
app/api/history/route.ts      GET  /api/history?token=...  — user's reports + scores (recomputed)
app/api/user/route.ts         PATCH /api/user?token=...    — update mode + opt_in
app/report/[id]/page.tsx      Public shareable report page
app/history/page.tsx          History page shell (Suspense)
app/history/HistoryClient.tsx History UI: charts, chips, toggles (client)
lib/claude.ts                 Health summary + Claude call
lib/scores.ts                 Recovery/sleep/strain/stress score algorithms
lib/supabase.ts               DB helpers
lib/types.ts                  All TypeScript types (incl. HealthScores — single source)
supabase/migrations/001_initial.sql  Run this in Supabase SQL editor
fixtures/health-data.json     30-day test payload with declining health pattern
docs/shortcut-payload.md            Full iOS Shortcut payload contract (spec)
docs/shortcut-mvp-build.md          MVP Shortcut build steps (DONE — works on-device)
docs/shortcut-enrichment-build.md   Full metric capture + daily-array pattern
docs/architecture-thin-shortcut.md  Open decision: thin Shortcut + server-side aggregation
docs/friend-install-guide.md        Manual onboarding + permission walkthrough for friends
docs/shortcut-registration-build.md Deferred: self-serve first-run registration flow
docs/learnings.md                   Running log of insights/decisions + who caught them
```

## Architecture decisions made

- **Token in query param**: `POST /api/analyze?token=abc123` — simpler for Shortcut
- **Self-serve registration**: Shortcut asks name/email/mode on first run, stores token in iCloud Drive
- **Invite code gate**: one code per group, hardcoded in Shortcut before sharing
- **Three user modes**: curious (default), active, performance — changes Claude prompt (per-mode prompts not yet written)
- **Scores computed server-side**: Sleep/Recovery/Strain/Stress passed to Claude as context; also shown to the user as chips + trend charts on the history page (recomputed from raw_data on read — not persisted)
- **Shareable reports**: `/report/[id]` is the referral loop — "Get True Mirror" CTA at the bottom
- **Notifications**: Vercel Cron (hourly) + email via Resend; user sets charge_reminder and wear_reminder times at registration with their timezone

## Things not yet decided

- **UX format**: scores vs narrative vs combination — hold until first real users
- **Verdict line**: one-line status at top of analysis — considered but not implemented, may be too athlete-centric for general persona
- **Rate limiting**: one analysis per user per day?

## Things still to build

- **iOS Shortcut: full metric capture** (MVP done; enrich next — pending thin/fat decision)
- **Onboard first friend manually** (then build registration flow)
- Registration flow (self-serve first-run) — deferred
- Per-mode Claude prompts (currently one general prompt)
- Data gap detection (detect Watch not worn, coach on charging habit)
- UI tuning (report + history pages) — deferred until real usage
- Email (wire up Resend in cron route)

## Done (Phase 3, 2026-05-31)

- ✅ History UI (`/history?token=...`) with score trend charts (Recovery/Sleep), report list, score chips, expandable analysis, share links
- ✅ History page mode toggle + opt-in/opt-out toggle (via `PATCH /api/user`)
- Note: scores are **not stored** — `GET /api/history` recomputes them from each report's `raw_data` via `computeScores()`

## Testing without a Shortcut

```bash
# First create a test user manually in Supabase SQL editor:
# INSERT INTO users (name) VALUES ('Test') RETURNING token;

# Then run analysis against fixture data:
curl -X POST "http://localhost:3000/api/analyze?token=PASTE_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d @fixtures/health-data.json
```

The fixture has a deliberate declining pattern (HRV dropping, sleep worsening, resting HR rising) — should produce Recovery ~35–40, Stress: high.
