# True Mirror — Claude Code Context

## What this is

True Mirror: iOS Shortcut reads Apple Health data → POSTs to Next.js API → Claude gives honest health analysis → saved to Supabase. Users install by tapping a shared link. No App Store, no XML export, no login.

Read `plan.md` and `why.md` for full context before doing anything.

## Current status

**Backend is code-complete but not deployed.** Everything in `app/` and `lib/` is written and committed. The next session should focus on deployment and the iOS Shortcut.

## What to do next (in order)

1. **Deploy Supabase**: create project at supabase.com, paste `supabase/migrations/001_initial.sql` into the SQL editor, run it
2. **Deploy Vercel**: connect GitHub repo (auto-detects Next.js), set env vars (see below), add DNS for truemirror.paahulhq.com
3. **Smoke test the API**: `curl -X POST "https://truemirror.paahulhq.com/api/analyze?token=YOUR_TOKEN" -H "Content-Type: application/json" -d @fixtures/health-data.json`
4. **Build the iOS Shortcut** — see `docs/shortcut-payload.md` for the full spec
5. **Wire up email** — install Resend, uncomment `sendEmail()` in `app/api/cron/nudge/route.ts`

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
app/api/cron/nudge/route.ts   GET  /api/cron/nudge         — hourly email reminders
app/report/[id]/page.tsx      Public shareable report page
lib/claude.ts                 Health summary + Claude call
lib/scores.ts                 Recovery/sleep/strain/stress score algorithms
lib/supabase.ts               DB helpers
lib/types.ts                  All TypeScript types
supabase/migrations/001_initial.sql  Run this in Supabase SQL editor
fixtures/health-data.json     30-day test payload with declining health pattern
docs/shortcut-payload.md      Full iOS Shortcut build spec
```

## Architecture decisions made

- **Token in query param**: `POST /api/analyze?token=abc123` — simpler for Shortcut
- **Self-serve registration**: Shortcut asks name/email/mode on first run, stores token in iCloud Drive
- **Invite code gate**: one code per group, hardcoded in Shortcut before sharing
- **Three user modes**: curious (default), active, performance — changes Claude prompt (per-mode prompts not yet written)
- **Scores computed server-side**: Sleep/Recovery/Strain/Stress passed to Claude as context, not shown directly to user yet
- **Shareable reports**: `/report/[id]` is the referral loop — "Get True Mirror" CTA at the bottom
- **Notifications**: Vercel Cron (hourly) + email via Resend; user sets charge_reminder and wear_reminder times at registration with their timezone

## Things not yet decided

- **UX format**: scores vs narrative vs combination — hold until first real users
- **Verdict line**: one-line status at top of analysis — considered but not implemented, may be too athlete-centric for general persona
- **Rate limiting**: one analysis per user per day?

## Things still to build

- Per-mode Claude prompts (currently one general prompt)
- Data gap detection (detect Watch not worn, coach on charging habit)
- History UI (`/history?token=...`) with score trend charts
- Email (wire up Resend in cron route)
- History page mode/opt-in toggles

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
