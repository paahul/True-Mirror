# True Mirror

Your health data, reflected honestly.

An iOS Shortcut reads your last 30 days of Apple Health & Fitness data, sends a compact
summary to a private API, and Claude returns a direct, no-sugarcoating analysis — what's
working, what needs attention, and three concrete things to do this week. In about ten
seconds. No App Store, no 2GB export, no login.

**Live:** [truemirror.paahulhq.com](https://truemirror.paahulhq.com)

---

## The interesting bits

A few decisions worth calling out:

**Shortcuts as a data pipeline.** The whole project hinges on one underused fact: iOS
Shortcuts has native HealthKit access. So instead of a native app (App Store, $99/yr, a
download per person) or the dreaded "Export All Health Data" (30–45 min, locks your phone,
2GB XML), the Shortcut reads your metrics and POSTs a summary to a Next.js API. You install
by tapping a link; your phone stays usable. This sits in a gap two groups rarely cross —
people who know Shortcuts well, and people who build web backends — which is why a clean
deployable version of it basically didn't exist.

**Calibrated honesty is the product.** Most health apps cheer you on — streaks, rings,
badges. True Mirror reads what's actually in the data and says it: your sleep's been slipping
for three weeks, your resting HR is climbing, you haven't trained in a month. The mirror
metaphor is the whole point — show what's there, not what you want to see.

**Scores grounded in published methods, not vibes.** Before Claude sees anything, the server
computes four signals from your raw numbers: **Sleep** (Oura-style stage weighting),
**Recovery** (Altini / HRV4Training — recent HRV vs your 30-day baseline + resting-HR
deviation + sleep), **Strain** (Banister TRIMP from per-workout heart rate, with a calorie
fallback), and a **Stress** level (HRV suppression your training load doesn't explain). The
scores orient Claude; Claude grounds its prose in the raw figures.

**Scores are recomputed, not stored.** The database keeps only the raw payload and the
analysis text — never the scores. The history endpoint recomputes them from each report's
`raw_data` on read, so the trend charts work retroactively and there's a single source of
truth for the math.

**The referral loop is a URL.** Every saved analysis gets a shareable `/report/[id]` page
with a "Get True Mirror" CTA. Someone shares their read; the next person taps the CTA.

**Incentives aligned on the Watch-charging problem.** People take their Watch off to charge
and forget to put it back on — and patchy data means worse analysis. True Mirror's value goes
up the more consistently you wear it, so optional charge/wear reminders (opt-in, your chosen
times) are squarely in the product's interest, not a dark pattern.

---

## Status

| Milestone | What it is | Status |
|---|---|---|
| **M1 — Backend** | Supabase schema, register/analyze/cron routes, server-side scores, shareable report pages — deployed to a custom domain with SSL | ✅ Shipped |
| **M2 — iOS Shortcut** | HealthKit → JSON → POST → analysis. MVP (steps/RHR/energy/exercise) works on-device; full metric capture next | 🟡 In progress |
| **M3 — History UI** | `/history` page: Recovery/Sleep trend charts, score chips, expandable analyses, mode + opt-out toggles | ✅ Shipped |
| **M4 — Onboard first friend** | Manual provisioning + permission walkthrough; validate the real-world flow before automating it | ⏳ Next |
| **M5 — Registration flow** | Self-serve first-run (name/email/mode → token) so one link self-provisions everyone | ⏳ Planned |
| **M6 — UI tuning** | Polish report + history pages once there's real usage | ⏳ Planned |
| **M7 — Email reminders** | Resend-backed charge/wear nudges (needs hourly cron → Vercel Pro) | ⏳ Planned |

There's an open architecture question — whether to keep aggregating in the Shortcut or send
raw samples and aggregate server-side — written up in
[`docs/architecture-thin-shortcut.md`](docs/architecture-thin-shortcut.md).

---

## How it works

```
  iPhone                         Vercel (Next.js)                   Services
┌──────────────┐  POST summary  ┌────────────────────┐
│ iOS Shortcut │ ─────────────▶ │ /api/analyze?token │
│  (HealthKit) │   JSON body    └─────────┬──────────┘
└──────────────┘                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                   computeScores()   Claude API      getUserByToken()
                   (lib/scores.ts) (Sonnet, analysis)  (Supabase)
                          │               │                │
                          └───────┬───────┘                │
                                  ▼                         ▼
                            analysis text  ──────▶  ┌──────────────────┐
                                                    │ Supabase reports │ (opt-in)
                                                    │ raw_data, text   │
                                                    └────────┬─────────┘
                                                             │
                          ┌──────────────────────────────────┼─────────────────┐
                          ▼                                  ▼
                  /report/[id] (shareable)         /history?token= (charts, chips)
                                                   scores recomputed from raw_data
```

Loading a report or history page is just a Supabase read — no AI call per view. A daily
Vercel Cron (`/api/cron/nudge`) handles reminder emails (stubbed until Resend is wired).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| AI | Anthropic Claude (Sonnet 4.6) via `@anthropic-ai/sdk`, prompt caching on the system prompt |
| Data pipeline | iOS Shortcuts → HealthKit (no native app, no XML export) |
| DB | Supabase Postgres (`users`, `reports`); service-role access, RLS on |
| Scoring | Server-side — Oura-style sleep, Altini/HRV4Training recovery, Banister TRIMP strain |
| Email | Resend (cron-driven reminders — wiring pending) |
| Hosting | Vercel (custom domain via Cloudflare DNS) |

UI is deliberately dependency-light — no component or chart library; the trend charts are
hand-rolled inline SVG.

---

## Local setup

```bash
git clone https://github.com/paahul/True-Mirror.git
cd True-Mirror
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev                  # http://localhost:3000
```

You'll need:
- **Anthropic** API key — https://console.anthropic.com (required)
- **Supabase** project — https://supabase.com (required). Run `supabase/migrations/001_initial.sql`
  in the SQL editor, then set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `INVITE_CODE` — any value; gates self-serve registration (same value goes in the Shortcut).
- **Resend** — only when wiring up reminder emails.

Test the pipeline without a Shortcut: create a user (`INSERT INTO users (name) VALUES ('Test') RETURNING token;`),
then `curl -X POST "http://localhost:3000/api/analyze?token=TOKEN" -H "Content-Type: application/json" -d @fixtures/health-data.json`.
The fixture has a deliberate declining pattern (HRV falling, sleep worsening) → expect Recovery ~35–45, Stress high.

The iOS Shortcut is built in the Shortcuts app — see the step-by-step guides in
[`docs/`](docs/) (`shortcut-mvp-build.md`, `shortcut-enrichment-build.md`).

---

## Cost notes

Built to run at friends-and-family scale for roughly nothing:

- Anthropic (Sonnet 4.6) — roughly a cent or so per analysis with prompt caching on
- Supabase free tier — 500 MB DB, plenty for this
- Vercel Hobby — free (cron capped at daily; hourly reminders need Pro)
- Resend free tier — 100 emails/day

Recurring cost for a personal deploy: ~$0/month + pennies per analysis.

---

## What's next

- Full metric capture in the Shortcut (sleep, HRV, workouts, VO₂ max) → unlock the Recovery
  and Sleep scores end-to-end on real data
- Decide the thin-Shortcut vs fat-Shortcut architecture (see `docs/`)
- Self-serve registration flow so one link onboards anyone
- Per-mode Claude prompts (curious / active / performance) and data-gap detection
- Polish pass on the report + history UI

---

## Project docs

- [`why.md`](why.md) — why this exists, the competitive gap, the Watch-charging angle
- [`plan.md`](plan.md) — full build plan, milestones, payload spec, open questions
- [`docs/`](docs/) — Shortcut build guides, friend install + permissions, architecture notes, learnings log
- [`CLAUDE.md`](CLAUDE.md) — context for working on this with Claude Code

---

## Why I built this

A real itch — I wanted an honest read on my own Apple Health data without a native app or the
2GB-export ordeal — and a way to learn full-stack AI product building end to end: structured
prompt design and server-side scoring with Claude, a Supabase-backed referral loop, and the
genuinely awkward last mile of shipping through iOS Shortcuts. The honesty framing isn't a
gimmick; it's the kind of product I actually want to exist.
