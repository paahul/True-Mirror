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

<!-- Add new entries above this line, newest first. Format:
## YYYY-MM-DD — short title
**Caught by:** who
**The catch / why it matters / decision / meta-lesson**
-->
