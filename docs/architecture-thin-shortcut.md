# Architecture decision: thin Shortcut vs fat Shortcut

**Raised by Paahul, 2026-06-01.** Open — decide before doing the metric enrichment.

## The observation

We aggregate health data *inside* the Shortcut (Calculate Statistics → averages/sums,
÷30, rounding, and Repeat loops for per-day arrays) so we only POST a handful of numbers.
The stated reason was to avoid shipping thousands of raw health samples.

**But that benefit didn't materialize.** On the first real run, iOS still:
- counted "5,750 health items" and required **Allow Sharing Large Amounts of Data**, and
- prompted **"send health data to truemirror.paahulhq.com?"**

iOS taints anything *derived* from HealthKit as health data and gates it the same way,
regardless of how much we reduced it client-side. So the heavy client-side math bought us
**no permission or privacy relief** — we pay the same prompts either way.

## The alternative: thin Shortcut, fat backend

Send lightly-shaped raw samples; do **all** computation server-side.

| | Fat Shortcut (current) | Thin Shortcut (proposed) |
|---|---|---|
| Shortcut complexity | High — stats, rounding, per-day Repeat loops, sleep-stage math | Low — Find samples → light shape → POST |
| Daily arrays (Pattern D loops) | Built in Shortcut (fiddly) | Server derives from raw — **eliminated in Shortcut** |
| Sleep stages | Painful in Shortcut | Easy server-side code |
| Averages vs daily | Built **twice** per metric | Sent once (raw), server derives both |
| Where the hard logic lives | Untestable Shortcut actions | Testable TypeScript (our strength) |
| Payload size | Tiny | Larger (KB–low MB) |
| Data sensitivity at rest | Low (just averages in `reports.raw_data`) | Higher (sample-level data stored) |
| iOS permission prompts | Same | Same |
| Backend work | None new | New ingest/transform layer |

**Net:** moves complexity off the side we *can't* test (Shortcut) onto the side we *can*
(backend). Given how fiddly today's build was and that I can't test Shortcuts on-device,
this is strategically attractive. The cost is a backend transform + larger/raw payload.

## The unknown to resolve first

How thin can the Shortcut actually get? Depends on how Shortcuts serializes health samples
when POSTing:
- **Best case:** "Find Health Samples" output can be POSTed and arrives as parseable JSON
  (array of sample objects with value/unit/dates). Then the Shortcut is nearly trivial:
  one Find per metric → combine → POST. No loops at all.
- **Likely case:** we add one small **Repeat** per metric to emit `{ "date": …, "value": … }`
  per sample into a list. Still far simpler than stats + per-day grouping.

## Validation test (do this on-device, ~10 min, before deciding)

1. Build a throwaway 3-action Shortcut:
   - **Find Health Samples** → Heart Rate Variability → last 7 days (small)
   - **Get Contents of URL** → POST to a request-bin / or to a temporary debug endpoint
     (ask Claude to add a `/api/debug-echo` route that logs and echoes the raw body)
   - **Quick Look** the response
2. Look at what arrived server-side. Is it clean JSON? What shape?
3. That shape decides the design:
   - clean array → ultra-thin Shortcut, server parses directly
   - opaque/messy → add a per-metric Repeat to shape `{date,value}` lists

## If we adopt it — backend changes

- Add a raw-ingest path: either a new `raw_samples` field on `/api/analyze` or a new
  endpoint. Accepts per-metric arrays of `{date, value}` (or whatever the test shows).
- Add a transform: raw samples → existing `HealthPayload` (compute averages, daily arrays,
  sleep stages) → feed the **unchanged** `computeScores()` + `analyzeHealth()`.
- Decide what to store in `reports.raw_data`: the raw samples (more sensitive) or the
  derived `HealthPayload` (privacy-friendlier). Recommendation: store the **derived**
  payload, not raw samples, to keep history low-sensitivity.

## Recommendation

Lean **yes** to the thin Shortcut — but run the validation test first to size how thin it
can be. If viable, it replaces most of `shortcut-enrichment-build.md` with a much simpler
Shortcut and a clean backend transform. Keep the current MVP working in the meantime.
