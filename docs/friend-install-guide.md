# Friend Install Guide (manual provisioning — Milestone 4)

For onboarding the **first friend** without building the registration flow yet.
Model: you create their user row, hardcode their token into a copy of the Shortcut,
and share it as a signed iCloud link.

---

## Part A — What you (Paahul) do

### 1. Create their user row
Create a user and grab the token (ask Claude to run this, or do it via Supabase):
```
POST {SUPABASE_URL}/rest/v1/users   (service-role key)
{ "name": "Friend's Name", "mode": "curious" }   → returns { token }
```
Keep their token handy.

### 2. Make their copy of the Shortcut
1. In the Shortcuts app, **duplicate** your working Shortcut (long-press → Duplicate).
2. In the copy, open the **analyze Get Contents of URL** action and change the
   `?token=` value to **their** token.
3. Rename the copy (e.g., "True Mirror — <Friend>").

### 3. Share it (signed, so they don't hit "untrusted")
- In the Shortcut: **•••** → **Share** → **Copy iCloud Link**.
  (iCloud links are signed/trusted — the cleanest path.)
- Send them that link **plus Part B below**.

> Alternative (CLI signing on your Mac): export the shortcut to a file, then
> `shortcuts sign -m anyone -i in.shortcut -o out.shortcut`. The iCloud link is easier.

---

## Part B — What your friend does (send them this)

> **Setting up True Mirror — ~3 minutes, mostly one-time taps.** iOS makes every health app
> ask permission for each data type — it's only *reading* your data, never changing it. Do the
> two settings below up front and the run goes smoothly.

*(This is the real flow, verified on a friend's phone 2026-06-02.)*

1. **First, one setting (do this before anything else):** open **Settings → Shortcuts →
   Advanced** and turn ON **"Allow Sharing Large Amounts of Data."** (Doing this first avoids a
   failed first run.)
2. **Tap the link** → **Add Shortcut**.
3. *(Optional)* Long-press the Shortcut → **Share → Add to Home Screen** for an app-like icon.
4. **Run it.** A "Would Like to Access Your Health Data" screen appears — tap **Turn On All** at
   the top (one tap grants every type), then **Allow**. *(One-time — it won't ask again.)*
5. **"Allow … to send health data to truemirror.paahulhq.com?"** → **Always Allow**
   (sends only computed summaries — the whole point).
6. **Wait ~20 seconds** (Claude is analyzing 30 days) → your **history page opens with your
   analysis**. Done. Tap the Shortcut (or its Home Screen icon) anytime to refresh.

**If anything fails:** "large amounts of data" error → you skipped step 1, flip it and re-run.
Missing data in the analysis → you tapped a toggle off; re-run and **Turn On All**.

**Your page is your home:** the Shortcut opens `truemirror.paahulhq.com/history?token=…`
(your private link) — add it to your Home Screen to revisit anytime; it shows trends as you
run it more.

---

## Permission prompts — the honest list

With the full metric set, the first run involves, in order:
1. "Add Shortcut" (install)
2. Settings toggle: **Allow Sharing Large Amounts of Data** (one-time, device-wide)
3. **Health read access** — one prompt per data type (can be ~6–10 taps with all metrics)
4. **"Send health data to truemirror.paahulhq.com"** → Always Allow

To reduce #3, only include the metrics you actually want. Every type you add = one more
tap for friends on first run. (This is the same gate native App Store health apps hit —
it's a trust feature, not a bug.)

---

## Troubleshooting (send if they get stuck)

| Symptom | Fix |
|---|---|
| "Untrusted Shortcut" won't add | Use the iCloud link (it's signed). Or Settings → Shortcuts → **Allow Untrusted Shortcuts** = ON. |
| "trying to share N health items, not allowed" | Settings → Shortcuts → Advanced → **Allow Sharing Large Amounts of Data** = ON. |
| "Can't access truemirror.paahulhq.com" | They tapped Don't Allow earlier. Open the Shortcut → **ⓘ** → **Privacy** → re-allow the website + Health. Then re-run and pick **Always Allow**. |
| No analysis / error text appears | Tell Paahul the exact message — likely a metric with no data on their device; he can tweak their copy. |

## After this friend works

Validated: real-world install, permission friction, and whether the analysis lands.
Then it's worth building the **registration flow** (`shortcut-registration-build.md`)
so you can share one link broadly without per-person provisioning.
