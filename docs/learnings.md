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

<!-- Add new entries above this line, newest first. Format:
## YYYY-MM-DD — short title
**Caught by:** who
**The catch / why it matters / decision / meta-lesson**
-->
