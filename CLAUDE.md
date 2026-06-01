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

## What to do next (in order)

1. **Build the iOS Shortcut** — see `docs/shortcut-payload.md` for the full spec. This is the next focus.
2. **Test on iPhone** against real Health data, iterate on the Claude prompt.
3. **Wire up email** — install Resend, uncomment `sendEmail()` in `app/api/cron/nudge/route.ts`, add `RESEND_API_KEY` to Vercel.

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
docs/shortcut-payload.md      Full iOS Shortcut build spec
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

- Per-mode Claude prompts (currently one general prompt)
- Data gap detection (detect Watch not worn, coach on charging habit)
- Email (wire up Resend in cron route)
- **iOS Shortcut** (Phase 2) — the next focus; nothing feeds the backend without it

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
