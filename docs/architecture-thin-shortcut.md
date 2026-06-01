# Architecture decision: thin Shortcut vs fat Shortcut

**Raised by Paahul, 2026-06-01. RESOLVED 2026-06-01 → stay FAT (aggregate in the Shortcut).**

## ✅ Resolution (do not reopen without re-testing)

We ran the validation test below. **The "thin / ultra-thin" approach is not viable**, so
we're staying with the **fat Shortcut** (Calculate Statistics → numbers, the proven MVP
path). Proceed with `shortcut-enrichment-build.md`; daily arrays use the Group-by-Day loop
in the Shortcut. **No backend ingest/transform layer needed.** The `/api/debug-echo` endpoint
used for the test has been deleted.

**Test result (the deciding evidence):** a 3-action Shortcut —
`Find Health Samples (HRV, 7 days)` → POST the raw result as a File body → echo — produced:

```json
{ "received_content_type": "text/plain", "byte_size": 2, "raw_preview": "79",
  "parsed_as_json": true, "shape": { "type": "number", "value": 79 } }
```

iOS **collapsed the entire sample list into a single scalar** (`79` — the sample count or
one value), sent as `text/plain`. It does **not** serialize the per-sample `{date, value}`
data for free. So the thin dream — "POST raw, let the server do everything, no loops" — is
dead: any structured data requires explicit shaping in the Shortcut (Calculate Statistics, or
a Repeat loop). Since loops are unavoidable either way, thin's whole advantage evaporates,
while fat is already working. Decision: **fat.**

---

_Original analysis (kept for the record):_

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

## Recommendation — superseded by the Resolution at the top

(Original lean was "yes, pending the test." The test came back negative — iOS won't
serialize sample arrays — so the final decision is **fat**. See the Resolution section at
the top of this file.)
