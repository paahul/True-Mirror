import type { HealthPayload } from './types'

export interface HealthScores {
  sleep: number | null
  recovery: number | null
  strain: number | null
  stress: 'low' | 'moderate' | 'high' | null
}

export function computeScores(health: HealthPayload): HealthScores {
  const sleep = computeSleepScore(health)
  const recovery = computeRecoveryScore(health, sleep)
  const strain = computeStrainScore(health)
  const stress = computeStressLevel(health, strain)
  return { sleep, recovery, strain, stress }
}

// Weighted sleep stage model (matches Oura published methodology)
// Duration 40pts | Deep 30pts | REM 20pts | Efficiency 10pts
function computeSleepScore(health: HealthPayload): number | null {
  const s = health.sleep
  if (!s) return null

  const duration   = Math.min(s.average_hours_asleep / 8.0, 1.0) * 40
  const deep       = s.avg_deep_minutes != null ? Math.min(s.avg_deep_minutes / 90, 1.0) * 30 : 15
  const rem        = s.avg_rem_minutes  != null ? Math.min(s.avg_rem_minutes  / 100, 1.0) * 20 : 10
  const efficiency = s.average_hours_in_bed
    ? Math.min(s.average_hours_asleep / s.average_hours_in_bed, 1.0) * 10
    : 7

  return Math.round(Math.min(duration + deep + rem + efficiency, 100))
}

// HRV baseline method (Altini / HRV4Training methodology)
// HRV 60pts | Resting HR 20pts | Sleep 20pts
function computeRecoveryScore(health: HealthPayload, sleepScore: number | null): number | null {
  const hrv = health.hrv_ms
  const hr  = health.heart_rate

  if (!hrv?.daily || hrv.daily.length < 7) return null

  const sorted    = [...hrv.daily].sort((a, b) => a.date.localeCompare(b.date))
  const recentHrv = mean(sorted.slice(-3).map(d => d.ms))
  const ratio     = recentHrv / hrv.average  // vs 30-day baseline

  // ratio 0→1.5 mapped to 0→60 pts
  const hrvScore  = Math.min(Math.max(ratio, 0), 1.5) / 1.5 * 60

  // RHR below personal baseline = better recovery
  let rhrScore = 10
  if (hr?.daily_resting && hr.daily_resting.length >= 7) {
    const sortedRhr  = [...hr.daily_resting].sort((a, b) => a.date.localeCompare(b.date))
    const recentRhr  = mean(sortedRhr.slice(-3).map(d => d.bpm))
    const rhrDiff    = (hr.resting_average - recentRhr) / hr.resting_average
    rhrScore = Math.min(Math.max((rhrDiff + 0.03) / 0.06 * 20, 0), 20)
  }

  const sleepContrib = sleepScore != null ? (sleepScore / 100) * 20 : 10

  return Math.round(Math.min(hrvScore + rhrScore + sleepContrib, 100))
}

// Banister TRIMP when per-workout avg HR available; calorie approximation otherwise
function computeStrainScore(health: HealthPayload): number | null {
  const rhr   = health.heart_rate?.resting_average ?? 60
  const maxHr = health.age_years ? 220 - health.age_years : 185

  const workoutsWithHr = (health.workouts ?? []).filter(w => w.avg_hr_bpm != null)

  if (workoutsWithHr.length > 0) {
    const totalTrimp = workoutsWithHr.reduce((sum, w) => {
      const hrRatio = Math.max(0, Math.min((w.avg_hr_bpm! - rhr) / (maxHr - rhr), 1))
      return sum + w.duration_minutes * hrRatio * Math.exp(1.92 * hrRatio)
    }, 0)
    // ~400 TRIMP units over 30 days ≈ 100/100
    return Math.round(Math.min(totalTrimp / 4, 100))
  }

  // Calorie-based approximation (no workout HR data)
  const cal = health.active_energy?.average
  const ex  = health.exercise_minutes?.average
  if (!cal && !ex) return null

  const calComponent = cal ? Math.min(cal / 500, 1) * 60 : 0
  const exComponent  = ex  ? Math.min(ex  / 60,  1) * 40 : 0
  return Math.round(Math.min(calComponent + exComponent, 100))
}

// HRV suppression unexplained by training load = life/psychological stress
function computeStressLevel(
  health: HealthPayload,
  strain: number | null,
): 'low' | 'moderate' | 'high' | null {
  const hrv = health.hrv_ms
  if (!hrv?.daily || hrv.daily.length < 7) return null

  const sorted    = [...hrv.daily].sort((a, b) => a.date.localeCompare(b.date))
  const recentHrv = mean(sorted.slice(-3).map(d => d.ms))
  const ratio     = recentHrv / hrv.average

  if (ratio >= 0.90) return 'low'
  // Suppressed HRV — training fatigue or life stress?
  return strain != null && strain > 55 ? 'moderate' : 'high'
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}
