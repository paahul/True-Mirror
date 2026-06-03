import type { HealthPayload, DayDelta, DayOverDay } from './types'

// Day-over-day = the one ACUTE signal in an otherwise 30-day-baseline report.
//
// The newest row in every `daily` array is the current, still-accumulating day:
// the Shortcut queries "last 30 days", which includes today-so-far, and the
// payload carries no run-timestamp/timezone. So we anchor "today" on the max
// date IN the array and step back off it, comparing the two most recent
// COMPLETED days. This makes the result idempotent across multiple same-day
// runs and immune to the midnight boundary (an 11:30pm and a 2am run never
// compare against a half-empty in-progress day). See why.md.

interface DayPair {
  latest: { date: string; value: number }
  prior:  { date: string; value: number }
}

function daysBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00Z`)
  const pb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(pa) || Number.isNaN(pb)) return Infinity
  return Math.abs(pb - pa) / 86_400_000
}

function completedDayPair<T extends { date: string }>(
  daily: T[] | undefined,
  getValue: (d: T) => number,
): DayPair | null {
  if (!daily || daily.length < 3) return null
  const sorted    = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const completed = sorted.slice(0, -1)              // drop the in-progress latest day
  const latest    = completed[completed.length - 1]
  const prior     = completed[completed.length - 2]
  if (!latest || !prior) return null
  // Skip across data gaps (e.g. Watch not worn) — only compare adjacent days.
  if (daysBetween(prior.date, latest.date) > 2) return null
  const lv = getValue(latest), pv = getValue(prior)
  if (!Number.isFinite(lv) || !Number.isFinite(pv)) return null
  return { latest: { date: latest.date, value: lv }, prior: { date: prior.date, value: pv } }
}

interface MetricCfg {
  key: string
  label: string
  unit: string
  decimals: number
  higherIsBetter: boolean
  pick: (h: HealthPayload) => DayPair | null
}

const METRICS: MetricCfg[] = [
  { key: 'hrv',        label: 'HRV',          unit: ' ms',    decimals: 0, higherIsBetter: true,  pick: (h) => completedDayPair(h.hrv_ms?.daily,            (d) => d.ms) },
  { key: 'sleep',      label: 'Sleep',        unit: 'h',      decimals: 1, higherIsBetter: true,  pick: (h) => completedDayPair(h.sleep?.daily,             (d) => d.hours_asleep) },
  { key: 'resting_hr', label: 'Resting HR',   unit: ' bpm',   decimals: 0, higherIsBetter: false, pick: (h) => completedDayPair(h.heart_rate?.daily_resting,(d) => d.bpm) },
  { key: 'steps',      label: 'Steps',        unit: '',       decimals: 0, higherIsBetter: true,  pick: (h) => completedDayPair(h.steps?.daily,             (d) => d.count) },
  { key: 'energy',     label: 'Active energy',unit: ' kcal',  decimals: 0, higherIsBetter: true,  pick: (h) => completedDayPair(h.active_energy?.daily,     (d) => d.kcal) },
  { key: 'exercise',   label: 'Exercise',     unit: ' min',   decimals: 0, higherIsBetter: true,  pick: (h) => completedDayPair(h.exercise_minutes?.daily,  (d) => d.minutes) },
  { key: 'resp',       label: 'Respiratory rate', unit: ' br/min', decimals: 1, higherIsBetter: false, pick: (h) => completedDayPair(h.respiratory_rate?.daily, (d) => d.breaths_per_min) },
  { key: 'spo2',       label: 'SpO2',         unit: '%',      decimals: 0, higherIsBetter: true,  pick: (h) => completedDayPair(h.spo2_percent?.daily,      (d) => d.pct) },
]

function fmt(n: number, decimals: number): string {
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()
}

// Relative size of the move — used to order deltas and pick the lead.
function significance(d: DayDelta): number {
  const base = Math.abs(d.prior)
  return base > 0 ? Math.abs(d.delta) / base : Math.abs(d.delta)
}

export function computeDayOverDay(health: HealthPayload): DayOverDay | null {
  const deltas: DayDelta[] = []
  let latestDate = '', priorDate = ''

  for (const m of METRICS) {
    const pair = m.pick(health)
    if (!pair) continue
    const round = (n: number) => (m.decimals > 0 ? Number(n.toFixed(m.decimals)) : Math.round(n))
    const value = round(pair.latest.value)
    const prior = round(pair.prior.value)
    const delta = round(pair.latest.value - pair.prior.value)  // round once, no float noise
    const favorable: DayDelta['favorable'] =
      delta === 0 ? 'neutral' : (delta > 0) === m.higherIsBetter ? 'good' : 'bad'
    deltas.push({ key: m.key, label: m.label, value, prior, delta, unit: m.unit, decimals: m.decimals, favorable })
    // All metrics share completed-day dates in practice; keep the most recent seen.
    if (pair.latest.date > latestDate) { latestDate = pair.latest.date; priorDate = pair.prior.date }
  }

  if (deltas.length === 0) return null
  deltas.sort((a, b) => significance(b) - significance(a))

  return { latestDate, priorDate, lead: buildLead(deltas), deltas }
}

// Readiness/physiology signals — these answer "should I back off today?".
// Activity outputs (steps/energy/exercise) are choices, not your body's state,
// so they fill the pills but never headline the lead.
const READINESS = new Set(['hrv', 'resting_hr', 'sleep', 'resp', 'spo2'])

// Deterministic narrative headline: lead with the biggest readiness mover,
// falling back to the biggest mover overall. `deltas` is already sorted by
// significance, so the first match is the most significant.
function buildLead(deltas: DayDelta[]): string {
  const moved = deltas.filter((d) => d.favorable !== 'neutral')
  const top = moved.find((d) => READINESS.has(d.key)) ?? moved[0]
  if (!top) {
    return 'Holding steady since your last full day — no notable overnight shifts.'
  }
  const dir = top.delta > 0 ? 'up' : 'down'
  const mag = fmt(Math.abs(top.delta), top.decimals)
  // Only give directional advice when the move is meaningful (≥5%); small
  // wobbles are noise, so we state the fact without telling them to act on it.
  const tone =
    significance(top) < 0.05
      ? 'a minor shift'
      : top.favorable === 'good'
      ? 'a move in the right direction'
      : 'worth taking it easy today'
  return `${top.label} is ${dir} ${mag}${top.unit} since your last full day — ${tone}.`
}

// The text block Claude sees. The pills/lead are shown to the user separately,
// so the prompt tells Claude to react to these numbers, not recite them.
export function formatDayOverDayForPrompt(dod: DayOverDay | null): string {
  if (!dod) return ''
  const lines = dod.deltas.map((d) => {
    const v = fmt(d.value, d.decimals)
    if (d.favorable === 'neutral') return `${d.label}: ${v}${d.unit} (flat vs prior day)`
    const arrow = d.delta > 0 ? '↑' : '↓'
    const mag   = fmt(Math.abs(d.delta), d.decimals)
    return `${d.label}: ${v}${d.unit} (${arrow}${mag} vs prior day's ${fmt(d.prior, d.decimals)}${d.unit})`
  })
  return ['DAY-OVER-DAY (most recent two completed days — acute signal, not a trend):', ...lines].join('\n')
}
