# True Mirror — Why This Exists

## What it is

True Mirror takes your Apple Health and Apple Fitness data, builds a health profile, and gives it to Claude for honest analysis and suggestions. No App Store. No exports. No freezing your phone.

You run an iOS Shortcut, it reads your last 30 days of health data in seconds, posts it to a backend, and you get back a real analysis — trends, patterns, things that need attention — in about 10 seconds. Analyses are saved so you can see how things change over time. Users can opt out of history if they prefer it stateless.

## The problem with every existing approach

**The XML export path:** Apple has a built-in "Export All Health Data" feature. It takes 30–45 minutes, pegs your CPU, locks up your phone, and produces a 2GB XML file. This is what most DIY projects and several paid apps make you do. It's painful enough that most people never do it twice.

**The native iOS app path:** Apps like Athlytic, Gentler Streak, and Helia are proper HealthKit apps built in Swift. Polished, but they require an App Store distribution, Apple takes 30% of any revenue, and each user has to independently discover and download them. Stanford's HealthGPT is the most well-known open source version — 1.9k stars — but it's code you compile in Xcode yourself. Not something you hand to a friend.

## What we're doing instead

iOS Shortcuts has native HealthKit access built in. You can read specific metrics — steps, sleep stages, HRV, resting heart rate, workouts, weight, VO2 max — format them as JSON, and POST to a URL, all without leaving Apple's ecosystem or building a native app.

This means:

- No App Store. No Xcode. No $99/year Apple Developer account.
- Users install by tapping a link. iOS prompts for HealthKit permissions automatically.
- Data collection takes seconds, not 45 minutes.
- The phone stays usable.

The backend is a Next.js API route on Vercel. It receives the health JSON, calls Claude, and returns a structured analysis. Supabase stores history per user.

## Why it's uncommon (and why I built my own)

The Shortcuts-as-data-pipeline approach needs two things that don't often overlap in one person: knowing Shortcuts well enough to use it as an API client, and being able to build and deploy a web backend. Developers who can build the backend tend to default to native iOS (the "proper" HealthKit path); power users who know Shortcuts don't usually think to point it at an API they built.

When I looked, I didn't find a clean, deployable version of this pattern — plenty of XML-export parsers and native iOS apps, but not a simple Shortcuts → webhook → LLM → per-user-history setup I could just use. So I built one for myself. (I'm not claiming it's never been done — just that it wasn't sitting there ready to use, and the per-device setup friction, which I learned the hard way, is a big reason it stays a personal tool rather than a product.)

## What Apple Health vs Apple Fitness means in practice

Both live in HealthKit — the same underlying framework. "Apple Health" is passive data your phone and Watch collect continuously: steps, sleep stages, heart rate, HRV, VO2 max, weight. "Apple Fitness" / Watch workouts are active sessions you start and stop: runs, rides, HIIT, yoga, with duration, calories, heart rate zones, distance. The Shortcut reads both from the same place. No distinction needed in the implementation.

## Why "True Mirror"

Most health apps are relentlessly positive. Streaks, badges, congratulations for closing your rings. Claude doesn't do that — it reads what's actually in the data and says what it sees. Your sleep has been getting worse for three weeks. Your resting heart rate is trending up. You haven't had a workout longer than 20 minutes in a month. That honesty is the product. A mirror that shows you what's actually there, not what you want to see.

## Closest existing project

[HealthLog](https://github.com/MBombeck/HealthLog) — self-hosted, Docker, Next.js, Apple Health import, AI insights. Built by a solo German developer in February 2026. The key differences: HealthLog requires you to run your own Docker server and uses the XML export. True Mirror is a Vercel deploy + a Shortcut link — a non-technical friend can be running it in 60 seconds.

## Stack

- Next.js (Vercel) — API route + history UI
- Supabase — users + reports tables
- Claude API — analysis and suggestions
- iOS Shortcuts — HealthKit data pipeline, shareable via link

## The Watch charging problem

There's a second, adjacent problem that True Mirror is positioned to help with: many people who own an Apple Watch don't wear it consistently because of the charging cycle. They want to wear it, but they take it off to charge, forget to put it back on, and slowly the habit breaks. Without consistent wearing, health data gets patchy — and patchy data means worse analysis.

No existing app addresses this because no app has a reason to. True Mirror does. Our value goes up the more consistently someone wears their Watch, so helping users build a reliable charging routine is directly in our interest.

The approach: detect data gaps (missing days in the 30-day window mean the Watch wasn't worn), surface this in the analysis, and offer opt-in reminders at times the user chooses — a charge reminder in the evening, a wear reminder in the morning. We can't access Watch battery level directly, but we don't need to. Scheduled prompting builds the routine just as effectively, and the user choosing their own reminder time means they're opting into a habit change, not just receiving a push notification.

This is a small feature in terms of implementation but meaningful in terms of user value — and it aligns our incentives cleanly with the user's.

## Who it's for (v1)

Friends and family. Not the App Store. The distribution model is a Shortcut link and a Vercel URL. At this scale, AI costs are negligible. The opt-in history feature means users who want to track trends over time can, and users who want privacy-first stateless analysis can do that too.
