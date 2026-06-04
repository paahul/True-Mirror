import type { HealthPayload, HealthScores, DayOverDay, MetricSnapshot } from './types'

// Builds the live value for each metric the narrative might tag with [[key]].
// Deterministic, computed from the same data as scores/day-over-day, so the
// chips render on read for every report (no extra storage).

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString()
  return Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1)
}

// day-over-day keys → snapshot keys. Sleep is excluded on purpose: its snapshot
// value is the /100 score, but its day-over-day delta is in hours — overlaying
// "↓0.2" on a score would be misleading.
const DOD_TO_SNAPSHOT: Record<string, string> = {
  hrv: 'hrv',
  resting_hr: 'resting_hr',
  steps: 'steps',
  energy: 'active_energy',
  exercise: 'exercise',
  resp: 'respiratory_rate',
  spo2: 'spo2',
}

export function computeMetricSnapshot(
  health: HealthPayload,
  scores: HealthScores,
  dod: DayOverDay | null,
): MetricSnapshot {
  const snap: MetricSnapshot = {}
  const set = (key: string, label: string, value: number | null | undefined, unit: string) => {
    if (value == null || !Number.isFinite(value)) return
    snap[key] = { label, value: `${fmtNum(value)}${unit}` }
  }

  // Scores
  if (scores.recovery != null) snap.recovery = { label: 'Recovery', value: `${scores.recovery}/100` }
  if (scores.sleep != null) snap.sleep = { label: 'Sleep', value: `${scores.sleep}/100` }
  if (scores.strain != null) snap.strain = { label: 'Strain', value: `${scores.strain}/100` }
  if (scores.stress != null) snap.stress = { label: 'Stress', value: scores.stress }

  // 30-day averages from the payload
  set('hrv', 'HRV', health.hrv_ms?.average, ' ms')
  set('resting_hr', 'Resting HR', health.heart_rate?.resting_average, ' bpm')
  set('steps', 'Steps', health.steps?.average, '/day')
  set('active_energy', 'Active energy', health.active_energy?.average, ' kcal')
  set('exercise', 'Exercise', health.exercise_minutes?.average, ' min')
  set('respiratory_rate', 'Respiratory rate', health.respiratory_rate?.avg_breaths_per_min, ' br/min')
  set('spo2', 'SpO2', health.spo2_percent?.average, '%')
  set('vo2', 'VO2 max', health.vo2_max_ml_kg_min, ' ml/kg/min')
  if (health.weight_kg?.latest != null) snap.weight = { label: 'Weight', value: `${fmtNum(health.weight_kg.latest)} kg` }

  // Overlay the day-over-day delta where units match
  if (dod) {
    for (const d of dod.deltas) {
      if (d.favorable === 'neutral') continue
      const key = DOD_TO_SNAPSHOT[d.key]
      if (!key || !snap[key]) continue
      const arrow = d.delta > 0 ? '↑' : '↓'
      const mag = d.decimals > 0 ? Math.abs(d.delta).toFixed(d.decimals) : Math.round(Math.abs(d.delta)).toLocaleString()
      snap[key].delta = `${arrow}${mag}`
      snap[key].favorable = d.favorable
    }
  }

  return snap
}
