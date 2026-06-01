import Anthropic from '@anthropic-ai/sdk'
import type { HealthPayload } from './types'
import { computeScores } from './scores'

const client = new Anthropic()

// Single source of truth for the analysis model — swap here, nowhere else.
export const ANALYSIS_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a direct, honest health coach analysing 30 days of Apple Health data. No sugarcoating. No generic advice. React to the actual numbers in front of you.

The data begins with computed scores derived from the raw metrics using published HRV and sleep research (Altini/HRV4Training for recovery, Banister TRIMP for strain). Use the scores as orientation — ground your analysis in the raw numbers below them.

Score interpretation:
- Recovery <40 = body is not ready; >70 = well recovered
- Sleep <50 = meaningful deficit; >75 = solid
- Strain 0–100 over 30 days: <30 low, 30–60 moderate, >60 high
- Stress 'high' with low strain = life/psychological stress, not training fatigue

Format your response in exactly three sections with these bold headers:

**What's working** — genuine positives backed by the data (2-3 points)

**What needs attention** — honest assessment of weak areas with specific numbers (2-3 points)

**Three things to do this week** — concrete, specific actions tied to this person's actual data

Rules:
- Be direct. Say what the numbers actually mean.
- Use the real figures. "Your resting HR of 72 is elevated for your activity level" not "your heart rate could be improved."
- When trend data is present (marked with ↑ or ↓), lead with the trend.
- HRV context: below 30ms poor, 30–50ms average, above 60ms good. Trend matters more than the absolute.
- VO2 max: below 35 poor, 35–45 average, above 50 good for adults.
- Sleep duration: under 7h asleep is a deficit.
- Sleep stages: deep <60min/night low (target 90+); REM <80min/night low (target 100+); awake >30min/night = fragmented sleep.
- Respiratory rate during sleep: 12–20 normal; above 20 can indicate illness or poor recovery.
- SpO2: 95–100% normal; 90–95% worth monitoring; below 90% flag clearly.
- Keep it under 450 words total.
- No nested bullet points — short punchy sentences only.
- Do not add a preamble or sign-off.`

function detectTrend<T extends { date: string }>(daily: T[], getValue: (d: T) => number): string | null {
  if (daily.length < 14) return null
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const recent  = sorted.slice(-7)
  const earlier = sorted.slice(0, sorted.length - 7)
  const recentAvg  = recent.reduce((s, d)  => s + getValue(d), 0) / recent.length
  const earlierAvg = earlier.reduce((s, d) => s + getValue(d), 0) / earlier.length
  if (earlierAvg === 0) return null
  const pct = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100)
  if (Math.abs(pct) < 5) return null
  return pct > 0 ? `↑ ${pct}% vs earlier` : `↓ ${Math.abs(pct)}% vs earlier`
}

function buildHealthSummary(health: HealthPayload, scores: ReturnType<typeof computeScores>): string {
  const lines: string[] = []

  // Computed scores block
  const scoreLines: string[] = []
  if (scores.sleep    != null) scoreLines.push(`Sleep ${scores.sleep}/100`)
  if (scores.recovery != null) scoreLines.push(`Recovery ${scores.recovery}/100`)
  if (scores.strain   != null) scoreLines.push(`Strain ${scores.strain}/100`)
  if (scores.stress   != null) scoreLines.push(`Stress: ${scores.stress}`)
  if (scoreLines.length > 0) {
    lines.push('SCORES: ' + scoreLines.join(' | '))
    lines.push('')
  }

  lines.push(`Period: last ${health.period_days ?? 30} days`)

  if (health.steps) {
    const trend = health.steps.daily
      ? detectTrend(health.steps.daily, (d) => d.count)
      : null
    lines.push(`Steps: avg ${health.steps.average.toLocaleString()}/day, total ${health.steps.total.toLocaleString()}${trend ? ` (${trend})` : ''}`)
  }

  if (health.sleep) {
    const { average_hours_asleep, average_hours_in_bed, avg_deep_minutes, avg_rem_minutes, avg_awake_minutes, daily } = health.sleep
    const trend    = daily ? detectTrend(daily, (d) => d.hours_asleep) : null
    const stageParts = [
      avg_deep_minutes  != null ? `deep ${avg_deep_minutes}min`  : null,
      avg_rem_minutes   != null ? `REM ${avg_rem_minutes}min`    : null,
      avg_awake_minutes != null ? `awake ${avg_awake_minutes}min`: null,
    ].filter(Boolean).join(', ')
    lines.push(`Sleep: avg ${average_hours_asleep.toFixed(1)}h asleep, ${average_hours_in_bed?.toFixed(1) ?? '—'}h in bed${trend ? ` (${trend})` : ''}${stageParts ? ` | ${stageParts}` : ''}`)
  }

  if (health.heart_rate) {
    const trend = health.heart_rate.daily_resting
      ? detectTrend(health.heart_rate.daily_resting, (d) => d.bpm)
      : null
    lines.push(`Resting HR: avg ${health.heart_rate.resting_average} bpm${trend ? ` (${trend})` : ''}`)
  }

  if (health.hrv_ms) {
    const trend = health.hrv_ms.daily
      ? detectTrend(health.hrv_ms.daily, (d) => d.ms)
      : null
    lines.push(`HRV: avg ${health.hrv_ms.average} ms${trend ? ` (${trend})` : ''}`)
  }

  if (health.vo2_max_ml_kg_min != null) {
    lines.push(`VO2 max: ${health.vo2_max_ml_kg_min} ml/kg/min`)
  }

  if (health.respiratory_rate) {
    const trend = health.respiratory_rate.daily
      ? detectTrend(health.respiratory_rate.daily, (d) => d.breaths_per_min)
      : null
    lines.push(`Respiratory rate (sleep): avg ${health.respiratory_rate.avg_breaths_per_min} breaths/min${trend ? ` (${trend})` : ''}`)
  }

  if (health.spo2_percent) {
    const trend = health.spo2_percent.daily
      ? detectTrend(health.spo2_percent.daily, (d) => d.pct)
      : null
    lines.push(`Blood oxygen (SpO2): avg ${health.spo2_percent.average}%${trend ? ` (${trend})` : ''}`)
  }

  if (health.active_energy) {
    const trend = health.active_energy.daily
      ? detectTrend(health.active_energy.daily, (d) => d.kcal)
      : null
    lines.push(`Active energy: avg ${health.active_energy.average} kcal/day${trend ? ` (${trend})` : ''}`)
  }

  if (health.exercise_minutes) {
    const trend = health.exercise_minutes.daily
      ? detectTrend(health.exercise_minutes.daily, (d) => d.minutes)
      : null
    lines.push(`Exercise: avg ${health.exercise_minutes.average} min/day${trend ? ` (${trend})` : ''}`)
  }

  if (health.workouts?.length) {
    const types = [...new Set(health.workouts.map(w => w.type))].join(', ')
    const withHr = health.workouts.filter(w => w.avg_hr_bpm != null)
    const hrNote = withHr.length > 0
      ? `, avg workout HR ${Math.round(withHr.reduce((s, w) => s + w.avg_hr_bpm!, 0) / withHr.length)} bpm`
      : ''
    lines.push(`Workouts: ${health.workouts.length} sessions (${types}${hrNote})`)
  }

  if (health.stand_hours) {
    lines.push(`Stand hours: avg ${health.stand_hours.daily_average}/day`)
  }

  if (health.weight_kg) {
    const delta = health.weight_kg.change_30d
    lines.push(`Weight: ${health.weight_kg.latest} kg (${delta >= 0 ? '+' : ''}${delta} kg over 30 days)`)
  }

  return lines.join('\n')
}

export async function analyzeHealth(health: HealthPayload, name?: string): Promise<string> {
  const scores  = computeScores(health)
  const summary = buildHealthSummary(health, scores)
  const addressee = name ? `${name}'s` : "this person's"

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 900,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Here is ${addressee} Apple Health data for the last 30 days:\n\n${summary}\n\nGive an honest analysis.`,
    }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text
}
