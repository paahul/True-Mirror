import type {
  HealthPayload,
  DailySteps,
  DailyHeartRate,
  DailyHRV,
  DailyEnergy,
  DailyExercise,
  DailyRespiratoryRate,
  DailySpO2,
  DailySleep,
  Workout,
} from './types'

// The iOS Shortcut sends a FLAT bag of whatever metrics it managed to read.
// Everything is optional — a user with no Watch sends no HRV/VO2; someone who
// never logs weight sends no weight. This maps that flat bag into the nested
// HealthPayload, dropping anything missing/empty so the rest of the pipeline
// never sees a half-populated object. Numbers may arrive as strings (Shortcuts
// dictionaries stringify), so everything is coerced + finiteness-checked.

export interface FlatMetrics {
  [key: string]: unknown
}

// → a finite number, or undefined if absent/empty/non-numeric
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : undefined
}

// → a non-empty array, or undefined
function arr<T>(v: unknown): T[] | undefined {
  return Array.isArray(v) && v.length > 0 ? (v as T[]) : undefined
}

// Daily arrays arrive as [{ date, <valueKey> }] where the value may be a string
// (Shortcut dictionaries stringify). Coerce the value to a number and drop any
// malformed entries. Returns undefined if nothing valid remains.
function dailyArr<K extends string>(
  v: unknown,
  valueKey: K,
): (Record<K, number> & { date: string })[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined
  const out = v.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const date = (e as Record<string, unknown>).date
    const val = num((e as Record<string, unknown>)[valueKey])
    if (date === undefined || date === null || date === '' || val === undefined) return []
    return [{ date: String(date), [valueKey]: val } as Record<K, number> & { date: string }]
  })
  return out.length > 0 ? out : undefined
}

export function normalizeFlatMetrics(m: FlatMetrics): HealthPayload {
  const health: HealthPayload = { period_days: num(m.period_days) ?? 30 }

  const age = num(m.age_years)
  if (age !== undefined) health.age_years = age

  // Steps — needs at least an average or total to be meaningful
  const stepsAvg = num(m.steps_avg)
  const stepsTotal = num(m.steps_total)
  const stepsDaily = dailyArr(m.steps_daily, 'count')
  if (stepsAvg !== undefined || stepsTotal !== undefined) {
    health.steps = { average: stepsAvg ?? 0, total: stepsTotal ?? 0 }
    if (stepsDaily) health.steps.daily = stepsDaily as DailySteps[]
  }

  // Resting heart rate
  const rhrAvg = num(m.rhr_avg)
  const rhrDaily = dailyArr(m.rhr_daily, 'bpm')
  if (rhrAvg !== undefined) {
    health.heart_rate = { resting_average: rhrAvg }
    if (rhrDaily) health.heart_rate.daily_resting = rhrDaily as DailyHeartRate[]
  }

  // HRV
  const hrvAvg = num(m.hrv_avg)
  const hrvRecent = num(m.hrv_recent)
  const hrvDaily = dailyArr(m.hrv_daily, 'ms')
  if (hrvAvg !== undefined) {
    health.hrv_ms = { average: hrvAvg }
    if (hrvRecent !== undefined) health.hrv_ms.recent = hrvRecent
    if (hrvDaily) health.hrv_ms.daily = hrvDaily as DailyHRV[]
  }

  const vo2 = num(m.vo2)
  if (vo2 !== undefined) health.vo2_max_ml_kg_min = vo2

  const resp = num(m.resp_avg)
  const respDaily = dailyArr(m.resp_daily, 'breaths_per_min')
  if (resp !== undefined) {
    health.respiratory_rate = { avg_breaths_per_min: resp }
    if (respDaily) health.respiratory_rate.daily = respDaily as DailyRespiratoryRate[]
  }

  const spo2 = num(m.spo2_avg)
  const spo2Daily = dailyArr(m.spo2_daily, 'pct')
  if (spo2 !== undefined) {
    health.spo2_percent = { average: spo2 }
    if (spo2Daily) health.spo2_percent.daily = spo2Daily as DailySpO2[]
  }

  // Active energy
  const energyAvg = num(m.energy_avg)
  const energyDaily = dailyArr(m.energy_daily, 'kcal')
  if (energyAvg !== undefined) {
    health.active_energy = { average: energyAvg }
    if (energyDaily) health.active_energy.daily = energyDaily as DailyEnergy[]
  }

  // Exercise minutes
  const exAvg = num(m.exercise_avg)
  const exDaily = dailyArr(m.exercise_daily, 'minutes')
  if (exAvg !== undefined) {
    health.exercise_minutes = { average: exAvg }
    if (exDaily) health.exercise_minutes.daily = exDaily as DailyExercise[]
  }

  // Sleep — needs at least hours asleep
  const sleepHours = num(m.sleep_hours)
  const sleepDaily = arr<DailySleep>(m.sleep_daily)
  if (sleepHours !== undefined) {
    health.sleep = { average_hours_asleep: sleepHours }
    const inBed = num(m.sleep_in_bed)
    const deep = num(m.sleep_deep)
    const rem = num(m.sleep_rem)
    const awake = num(m.sleep_awake)
    if (inBed !== undefined) health.sleep.average_hours_in_bed = inBed
    if (deep !== undefined) health.sleep.avg_deep_minutes = deep
    if (rem !== undefined) health.sleep.avg_rem_minutes = rem
    if (awake !== undefined) health.sleep.avg_awake_minutes = awake
    if (sleepDaily) health.sleep.daily = sleepDaily
  }

  const workouts = arr<Workout>(m.workouts)
  if (workouts) health.workouts = workouts

  const stand = num(m.stand_avg)
  if (stand !== undefined) health.stand_hours = { daily_average: stand }

  const wLatest = num(m.weight_latest)
  if (wLatest !== undefined) {
    health.weight_kg = { latest: wLatest, change_30d: num(m.weight_change) ?? 0 }
  }

  return health
}
