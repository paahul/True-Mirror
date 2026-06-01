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

## iOS Shortcut status (Milestone 2 — in progress)

**MVP Shortcut works on Paahul's iPhone (2026-06-01).** Reads steps / resting HR / active
energy / exercise (averages) → builds JSON in a Text action → POSTs as a **File** body to
`/api/analyze?token=…` → shows Claude's analysis → saves to history. Paahul's own token:
`3083b194-a2ab-4035-ac41-6af4a3985e55` (user "Paahul", performance mode).

**Architecture decided (2026-06-01): FAT Shortcut.** An on-device test showed iOS won't
serialize a health-sample list to JSON (it collapses to a single scalar), so the "thin
Shortcut" idea is dead — aggregate in the Shortcut. See `docs/architecture-thin-shortcut.md`
and `docs/learnings.md`.

**What to do next (in order):**
1. **Enrich metrics** — `docs/shortcut-enrichment-build.md` (HRV + sleep first → unlock
   Recovery/Sleep scores; then daily arrays via the Group-by-Day loop → trends).
2. **Onboard first friend manually** — `docs/friend-install-guide.md` (no registration flow yet).
3. **Registration flow** (deferred) — `docs/shortcut-registration-build.md`.
4. **UI tuning**, then **email** (Resend in cron route).

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
