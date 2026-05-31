# True Mirror

Your health data, reflected honestly.

True Mirror reads your Apple Health and Apple Fitness data via an iOS Shortcut,
sends it to Claude, and gives you a direct analysis — what's going well, what
needs attention, and a few concrete things to act on. No sugarcoating.

## How it works

1. Tap the Shortcut (install by tapping a link I send you)
2. iOS asks for Health permissions on first run
3. Your last 30 days of data gets analysed by Claude
4. You get a report in ~10 seconds

Analyses are saved so you can see trends over time. Opt out of history anytime.

## Why this exists

Every existing approach to getting AI analysis on your Apple Health data has
a meaningful catch.

**Paid apps (Athlytic, Gentler Streak, Helia)** are native iOS apps on the
App Store. They work well but they require each person to independently
discover, download, and set them up. You can't just send someone a link and
have them running in 60 seconds.

**Stanford's HealthGPT** is the most well-known open source version — 1.9k
stars on GitHub, genuinely good work. But it's Swift code you compile in
Xcode and sideload onto your phone yourself. Not something you hand to a
friend who doesn't own a Mac.

**DIY projects** almost universally rely on Apple's built-in health export.
That export takes 30–45 minutes, locks up your phone the entire time, and
produces a 2GB XML file. It's painful enough that most people who try it
once never do it again.

**The gap:** iOS Shortcuts has native HealthKit access built in. You can read
specific metrics — steps, sleep stages, HRV, resting heart rate, workouts,
VO2 max — format them as JSON, and POST to an API in seconds. No App Store.
No Xcode. No export. The phone stays usable.

The reason nobody has packaged this cleanly is that it sits at the
intersection of two groups that rarely overlap: people who know Shortcuts
well enough to use it as a data pipeline, and people who can build and deploy
a web backend. True Mirror is that intersection.

## Stack

- Next.js + Vercel
- Supabase
- Claude API
- iOS Shortcuts
