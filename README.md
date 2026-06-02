# True Mirror

**Your health data, reflected honestly.**

True Mirror reads your last 30 days of Apple Health and Apple Fitness data via an iOS Shortcut, sends a compact summary to Claude, and hands back a direct, no-sugarcoating read: what's working, what needs attention, and three things to do this week. In about ten seconds.

No App Store. No 2GB export. No login.

**Live:** [truemirror.paahulhq.com](https://truemirror.paahulhq.com)

> **It's a personal tool, not an App Store product — by design.** There's no frictionless install
> (the iOS Shortcut + HealthKit route trades App Store distribution for real per-device setup
> friction). Great for yourself or a motivated friend; not for the masses. **Build your own:**
> see [`docs/build-your-own.md`](docs/build-your-own.md).

## What you get

A read you can act on, not a dashboard to interpret. A sample:

> **What's working** — Your aerobic base is holding. VO₂ max of 41 hasn't slipped despite the lighter month.
>
> **What needs attention** — HRV dropped 31% to 44ms and resting HR is up to 68. You're recovering worse while training less. That's stress, not fatigue.
>
> **Three things to do this week** — Fix the 90-minute gap between lights-out and asleep. Track HRV daily back above 50. Three easy zone-2 walks before any hard session.

Behind the words are four signals, each grounded in published methods rather than invented:

- **Recovery** — HRV vs. your own baseline, plus resting HR and sleep. Are you ready to push or should you back off? (Altini / HRV4Training method.)
- **Sleep** — Duration plus deep/REM/efficiency, weighted in the spirit of Oura, not just hours in bed.
- **Strain** — Training load from your workouts' heart rate (Banister TRIMP), or activity when HR isn't available.
- **Stress** — HRV suppression that your training load doesn't explain. Life stress, not just fatigue.

The scoring uses citable methods, so you can check the math.

## How it works

1. **Tap the Shortcut.** You install it by tapping a link someone sends you. No App Store, no Xcode.
2. **Allow Health access.** iOS asks once which data it can read. It only reads, and never changes anything.
3. **Claude reads 30 days.** Recent steps, sleep, heart rate, HRV, and workouts get analyzed against the methods above.
4. **Get your report (~10s).** Saved, if you want, so you can watch trends over time.

## The interesting bits

A few decisions worth calling out:

- **Shortcuts as a data pipeline.** iOS Shortcuts has native HealthKit access, so there's no native app and no XML export — the Shortcut reads your metrics and POSTs a summary to a Next.js API. (An on-device test confirmed iOS won't serialize a raw sample list, so the Shortcut aggregates before sending — see [`docs/learnings.md`](docs/learnings.md).)
- **Calibrated honesty is the product.** No streaks or badges — it says what's in the data, even when that's "your sleep's been slipping for three weeks."
- **Scores grounded in published methods**, not vibes — Oura-style sleep, Altini/HRV4Training recovery, Banister TRIMP strain. They orient Claude; Claude grounds its prose in the raw figures.
- **Scores are recomputed, not stored.** The DB keeps only the raw payload + analysis text; the history endpoint recomputes scores from `raw_data` on read, so trend charts work retroactively and there's one source of truth for the math.
- **The referral loop is a URL.** Every saved analysis gets a shareable `/report/[id]` page with a "Get True Mirror" CTA.
- **Incentives aligned on the Watch-charging problem.** The app's value rises the more consistently you wear your Watch, so the (opt-in) charge/wear reminders are in the product's interest, not a dark pattern.

## How it's built

```
  iPhone                         Vercel (Next.js)                   Services
┌──────────────┐  POST summary  ┌────────────────────┐
│ iOS Shortcut │ ─────────────▶ │ /api/analyze?token │
│  (HealthKit) │   JSON body    └─────────┬──────────┘
└──────────────┘                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                   computeScores()   Claude API      getUserByToken()
                   (lib/scores.ts) (Sonnet, analysis) (Supabase)
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

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| AI | Claude Sonnet 4.6 via `@anthropic-ai/sdk`, prompt caching on the system prompt |
| Data pipeline | iOS Shortcuts → HealthKit (no native app, no XML export) |
| DB | Supabase Postgres (`users`, `reports`); service-role access, RLS on |
| Scoring | Server-side — Oura-style sleep, Altini/HRV4Training recovery, Banister TRIMP strain |
| Hosting | Vercel (custom domain via Cloudflare DNS) |

Loading a report or history page is just a Supabase read — no AI call per view. UI is deliberately dependency-light: no component or chart library; the trend charts are hand-rolled inline SVG.

## Status

| Milestone | What it is | Status |
|---|---|---|
| **M1 — Backend** | Schema, analyze/cron routes, server-side scores, shareable report pages — deployed with a custom domain + SSL | ✅ Shipped |
| **M2 — iOS Shortcut** | HealthKit → JSON → POST → analysis. Full metric capture (steps, RHR, HRV, energy, exercise, VO₂, respiratory, SpO2, weight) → real Recovery/Strain/Stress. Tolerant of any data subset | ✅ Working |
| **M3 — History UI** | `/history`: trend charts, score chips, expandable analyses, mode + opt-out toggles | ✅ Shipped |
| **M4 — Onboard first friends** | Manual provisioning; validated end-to-end on two real (non-builder) phones, sparse and dense data | ✅ Done |
| **M5 — Registration flow** | Self-serve first-run token provisioning | ❌ Dropped — doesn't remove the real (permission/device) friction; manual provisioning is fine at personal scale |
| **M6 — UI tuning / richer charts** | Whoop-style per-day visuals; needs more granular capture | ⏸️ Deferred |
| **M7 — Email reminders** | Resend-backed charge/wear nudges (needs hourly cron → Vercel Pro) | ⏸️ Deferred |

Scope call (2026-06-02): after validating on real friends, this is a **personal tool**, not a
broad-distribution product — the iOS Shortcut route trades App Store reach for per-device setup
friction that no amount of polish removes. Energy goes into making it solid for yourself + a few
people, and into airtight docs (`docs/build-your-own.md`) for anyone who wants to build their own.

## Privacy

Only computed summaries leave your phone, never a raw dump of your health history. Saving reports to track trends is opt-in, and you can turn it off any time. Because the scoring uses published, citable methods, you can verify what the numbers mean.

## Why this exists

Every existing way to get AI analysis on your Apple Health data has a meaningful catch.

**Paid apps (Athlytic, Gentler Streak, Helia)** work well, but they're native iOS apps. Each person has to independently discover, download, and set them up. You can't just send someone a link and have them running in 60 seconds.

**Stanford's HealthGPT** is the best-known open-source version (1.9k stars, genuinely good work). But it's Swift you compile in Xcode and sideload yourself. Not something you hand to a friend who doesn't own a Mac.

**DIY projects** almost all rely on Apple's built-in export. That takes 30–45 minutes, locks up your phone the whole time, and produces a 2GB XML file. Painful enough that most people who try it once never do it again.

**The gap:** iOS Shortcuts has native HealthKit access. You can read specific metrics — steps, sleep stages, HRV, resting heart rate, workouts, VO₂ max — format them as JSON, and POST to an API in seconds. No App Store, no Xcode, no export. The phone stays usable.

The reason nobody packaged this cleanly is that it sits at the intersection of two groups that rarely overlap: people who know Shortcuts well enough to use it as a data pipeline, and people who can build and deploy a web backend. True Mirror is that intersection.

## Local setup

```bash
git clone https://github.com/paahul/True-Mirror.git
cd True-Mirror
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev                  # http://localhost:3000
```

You'll need an **Anthropic** key (required) and a **Supabase** project (run `supabase/migrations/001_initial.sql` in the SQL editor, then set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). `INVITE_CODE` gates registration (same value goes in the Shortcut); **Resend** is only needed for reminder emails.

Test the pipeline without a Shortcut: create a user (`INSERT INTO users (name) VALUES ('Test') RETURNING token;`), then `curl -X POST "http://localhost:3000/api/analyze?token=TOKEN" -H "Content-Type: application/json" -d @fixtures/health-data.json`. The fixture has a deliberate declining pattern → expect Recovery ~35–45, Stress high.

## Cost notes

Built to run at friends-and-family scale for roughly nothing:

- Anthropic (Sonnet 4.6) — about a cent per analysis with prompt caching on
- Supabase free tier — 500 MB DB, plenty
- Vercel Hobby — free (cron capped at daily; hourly reminders need Pro)
- Resend free tier — 100 emails/day

Recurring cost for a personal deploy: ~$0/month + pennies per analysis.

## Getting started

**Build your own** (it's open source): deploy the backend + assemble one iOS Shortcut (~1 hour,
once) → **[`docs/build-your-own.md`](docs/build-your-own.md)** has the airtight end-to-end steps.

Or, if you'd rather not build it, [reach out](mailto:sikandpaahul@gmail.com?subject=True%20Mirror)
and I'll hand-provision a copy (heads-up: first-run involves a few one-time iOS Health permission taps).

## Project docs

- **[`docs/build-your-own.md`](docs/build-your-own.md)** — the airtight end-to-end build guide (start here to make your own)
- [`why.md`](why.md) — why this exists, the competitive gap, the Watch-charging angle
- [`plan.md`](plan.md) — build plan, milestones, payload spec, open questions
- [`docs/`](docs/) — detailed Shortcut build steps, install guide, architecture notes, and `learnings.md` (every gotcha we hit + why)
- [`CLAUDE.md`](CLAUDE.md) — context for working on this with Claude Code

## Why I built this

A real itch — I wanted an honest read on my own Apple Health data without a native app or the 2GB-export ordeal — and a way to learn full-stack AI product building end to end: structured prompt design and server-side scoring with Claude, a Supabase-backed referral loop, and the genuinely awkward last mile of shipping through iOS Shortcuts. The honesty framing isn't a gimmick; it's the kind of product I actually want to exist.

---

Built by [Paahul](https://paahulhq.com). Reads Apple Health, analyzed by Claude.
