# Learnings & decisions log

A running record of non-obvious insights, course-corrections, and **who caught them** —
so the reasoning isn't lost and good catches are credited. Newest first.

---

## 2026-06-01 — Client-side aggregation in the Shortcut bought us nothing
**Caught by:** Paahul (the builder).

**The catch:** We designed the iOS Shortcut to compute averages/sums/rounding (and planned
per-day loops) *on-device* so we'd "send fewer health items" to the API. On the first real
run it became clear iOS taints **anything derived from HealthKit** and gates it the same way
regardless of how much we reduce it — it still required **Allow Sharing Large Amounts of
Data** and an **Always Allow send to truemirror.paahulhq.com** prompt. So the heavy
client-side math delivered **zero** permission or privacy benefit.

**Why it matters:** The complexity was justified by a benefit that doesn't actually exist.
That's pure cost — more fragile Shortcut actions (which we can't even test from the dev side),
more build effort, more failure points — for nothing.

**Decision it triggered:** Evaluate a **"thin Shortcut, fat backend"** architecture — send
lightly-shaped raw samples, do all aggregation/scoring server-side (testable code). See
`architecture-thin-shortcut.md`. Pending an on-device serialization test before committing.

**Meta-lesson (applies beyond this project):** Before building or elaborating a complex
approach, state the benefit it's supposed to buy and verify it actually does — *before*
investing. Scrutinize complexity hardest on the side that's hard to test (Shortcuts) vs.
the side that's easy to test (backend). The builder caught this one; the goal is to catch
it proactively next time.

---

## 2026-06-01 — iOS Shortcuts won't serialize a health-sample list to JSON
**Caught by:** a validation test (Paahul ran it on-device), built to resolve the thin-vs-fat question.

**The test:** a 3-action Shortcut — `Find Health Samples (HRV, 7 days)` → POST the raw result
as a File body → echo it via a temporary `/api/debug-echo`. The server received
`text/plain`, 2 bytes, body `"79"` — iOS had **collapsed the entire sample list into a single
scalar** (the count or one value), not the per-sample `{date, value}` data.

**Why it matters:** it killed the "thin Shortcut" idea. The whole appeal was *"POST raw
samples, let the server aggregate, no loops in the Shortcut."* But Shortcuts won't hand over a
structured array for free — you must shape data explicitly (Calculate Statistics → a number,
or a Repeat loop → a list). Since loops are unavoidable either way, thin's advantage vanished.

**Decision:** stay **fat** (aggregate in the Shortcut, the proven MVP path); daily arrays use
the in-Shortcut Group-by-Day loop; no backend ingest layer. Details in
`architecture-thin-shortcut.md`. Debug endpoint deleted after the test.

**Meta-lesson:** a 10-minute on-device probe settled an architecture question that could've
become a large speculative rewrite. When the unknown is "what does this opaque platform
actually do," test the smallest real version before designing around an assumption.

## 2026-06-02 — The Shortcut must be resilient to missing metrics (before sharing)
**Caught by:** Paahul (the builder).

**The catch:** the hand-typed Text JSON body breaks if any metric has no data — an empty
variable yields `"key": ,` (invalid JSON). For Paahul's own device that never happens, but
across a **broad user base** (no Watch → no HRV/VO2; never logged weight, etc.) it would fail
constantly. "Just drop the field manually" doesn't scale to real users.

**The fix (a dedicated hardening pass, before Milestone 4 / sharing):**
1. **Shortcut:** build the request body with a **Dictionary action** that only adds keys that
   have a value (skip-empty), instead of a hand-typed Text template. Natively valid JSON, and
   it also removes the smart-quote breakage risk.
2. **Backend:** add null/empty guards in `lib/claude.ts` (`buildHealthSummary`) so any
   missing metric is simply skipped, never `.toLocaleString()`-on-null crashes. `lib/scores.ts`
   is mostly guarded already via optional chaining.

**Status:** known gap. Fine to finish Paahul's personal build with the Text template (his data
exists); **must harden before onboarding anyone else.**

**Meta-lesson:** "works on the builder's device" ≠ "works for the segment." Pressure-test the
unhappy path (missing data, no Watch) before shipping to others.

## 2026-06-02 — First real friend onboarded; the iOS permission tax is the floor
**Validated by:** Paahul (ran the full flow on Aditi's phone).

**What happened (the real onboarding flow):** tap link → Add Shortcut → (Add to Home Screen) →
run → **fails** (health access) → grant access per type (~10 Allow taps) → run → **fails**
(Allow Sharing Large Amounts of Data not set) → flip that in Settings → Shortcuts → Advanced →
run → ~20s wait → history page opens with the analysis. End-to-end success for a non-builder.

**The friction, quantified:** ~10 health-permission taps + 1 Settings toggle + up to two
failed runs before it works. Most of this is the **unavoidable iOS tax** for any HealthKit app.

**Implications:**
- The registration flow (M5) removes Paahul's per-person token wrangling, but **not** these
  permission prompts — they're iOS, not us. This friction is roughly the floor for this
  architecture.
- Levers we *do* control: (a) front-load the "Large Amounts of Data" toggle in instructions
  (done in friend-install-guide), (b) **trim metrics** to cut the ~10 prompts (fewer Find
  Health Samples types = fewer Allows; tradeoff: less analysis context), (c) show an
  "Analyzing…" indicator for the ~20s wait.
- UX win shipped same day: the Shortcut now ends by opening the user's `/history` page
  (latest analysis auto-expanded) → a persistent, app-like home instead of a transient alert.

## 2026-06-02 — Dense metrics (Active Energy) crash the Shortcut; fix = Group by Day
**Caught by:** Paahul (debugging why Abhishek's run failed where Aditi's worked).

**Symptom:** "There was a problem running the shortcut" on a friend with **lots** of health
data, while a friend with sparse data succeeded. Nothing saved server-side (crash happened
before the POST). Backend, token, and copy structure were all fine.

**Cause:** `Find Health Samples → Calculate Statistics (Sum)` over a *dense* metric —
**Active Energy** especially (hundreds of samples/day) — means summing thousands of raw
samples, which times out / errors in Shortcuts. Sparse-data users stay under the limit;
dense-data users crash. (Well-documented Shortcuts perf gotcha.)

**Fix:** set **Group by: Day** on the Find action. iOS pre-aggregates to ~30 daily values, so
Calculate Statistics runs over 30 items instead of thousands — same result, ~10min→<5s.
Apply to all 30-day metrics (steps, active energy, exercise, RHR, HRV, respiratory, SpO2);
not needed for VO2/Weight (Limit 1). Build guides updated.

**Meta-lesson:** "works on the builder's phone" hid this too — Paahul's data wasn't dense
enough to trip it. Same theme as the missing-metric gap: test against the *range* of real
users, not just your own device.

## 2026-06-02 — Steps/energy double-count for Apple Watch wearers (multi-source)
**Caught by:** Abhishek (noticed his steps were ~2× reality), via Paahul.

**Cause:** iPhone *and* Apple Watch each record steps/active-energy/exercise. The Health app
deduplicates by source priority, but our `Find Health Samples → Sum` adds samples from **all
sources** → ~2× for Watch wearers. Single-source (phone-only) users are unaffected.

**Fix:** add a **Source filter** to the Steps / Active Energy / Exercise Find actions to keep
one source (the Watch, for wearers). Confirmed it fixes the count.

**The snag for distribution:** the Source filter stores a *specific device*, so it does NOT
travel in a shared shortcut copy (each phone's devices are named differently) — every
Watch-wearer has to set their own source once. Phone-only users need no filter (and filtering
to "Watch" would zero their steps). So it's a one-time per-Watch-user tweak; fine for the
manual model, but the **registration-flow/future version needs a cleaner answer** (a first-run
"which device do you wear?" step, or instruct Claude to treat absolute step counts as
approximate and lean on trends).

**Meta-lesson (again):** the builder's own device hid it — need to test across device setups
(Watch vs phone-only, sparse vs dense), not just one phone. Third time this theme has appeared.

<!-- Add new entries above this line, newest first. Format:
## YYYY-MM-DD — short title
**Caught by:** who
**The catch / why it matters / decision / meta-lesson**
-->
