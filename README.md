# True Mirror

**Your health data, reflected honestly.**

True Mirror reads your last 30 days of Apple Health and Apple Fitness data via an iOS Shortcut, sends a compact summary to Claude, and hands back a direct, no-sugarcoating read: what's working, what needs attention, and three things to do this week. In about ten seconds.

No App Store. No 2GB export. No login.

**Live:** [truemirror.paahulhq.com](https://truemirror.paahulhq.com) (currently a small private beta — invite by [email](mailto:sikandpaahul@gmail.com?subject=True%20Mirror%20invite))

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

## Privacy

Only computed summaries leave your phone, never a raw dump of your health history. Saving reports to track trends is opt-in, and you can turn it off any time. Because the scoring uses published, citable methods, you can verify what the numbers mean.

## Why this exists

Every existing way to get AI analysis on your Apple Health data has a meaningful catch.

**Paid apps (Athlytic, Gentler Streak, Helia)** work well, but they're native iOS apps. Each person has to independently discover, download, and set them up. You can't just send someone a link and have them running in 60 seconds.

**Stanford's HealthGPT** is the best-known open-source version (1.9k stars, genuinely good work). But it's Swift you compile in Xcode and sideload yourself. Not something you hand to a friend who doesn't own a Mac.

**DIY projects** almost all rely on Apple's built-in export. That takes 30–45 minutes, locks up your phone the whole time, and produces a 2GB XML file. Painful enough that most people who try it once never do it again.

**The gap:** iOS Shortcuts has native HealthKit access. You can read specific metrics — steps, sleep stages, HRV, resting heart rate, workouts, VO₂ max — format them as JSON, and POST to an API in seconds. No App Store, no Xcode, no export. The phone stays usable.

The reason nobody packaged this cleanly is that it sits at the intersection of two groups that rarely overlap: people who know Shortcuts well enough to use it as a data pipeline, and people who can build and deploy a web backend. True Mirror is that intersection.

## Stack

- Next.js + Vercel
- Supabase
- Claude API
- iOS Shortcuts

## Getting started

If someone sent you the Shortcut link, setup takes about two minutes:

1. Tap the link → **Add Shortcut**.
2. Settings → Shortcuts → Advanced → turn on **Allow Sharing Large Amounts of Data**.
3. Run it → **Allow** the Health prompts, then **Always Allow** sending your summary.
4. Read your analysis. Tap the Shortcut anytime to run it again.

[Request an invite →](mailto:sikandpaahul@gmail.com?subject=True%20Mirror%20invite)

---

Built by [Paahul](https://paahulhq.com). Reads Apple Health, analyzed by Claude.
