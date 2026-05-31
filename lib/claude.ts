import Anthropic from '@anthropic-ai/sdk'
import type { HealthPayload } from './types'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a direct, honest health coach analysing 30 days of Apple Health data. No sugarcoating. No generic advice. React to the actual numbers in front of you.

Format your response in exactly three sections with these bold headers:

**What's working** — genuine positives backed by the data (2-3 points)

**What needs attention** — honest assessment of weak areas with specific numbers (2-3 points)

**Three things to do this week** — concrete, specific actions tied to this person's actual data

Rules:
- Be direct. Say what the numbers actually mean.
- Use the real figures. "Your resting HR of 72 is elevated for your activity level" not "your heart rate could be improved."
- When trend data is present (marked with ↑ or ↓), lead with the trend. "Your HRV has dropped 18% in the last week" is more useful than "your HRV averages 42ms."
- HRV context: below 30ms is poor, 30–50ms is average, above 60ms is good. Trend matters more than the absolute number.
- VO2 max context: below 35 is poor, 35–45 is average, above 50 is good for adults.
- Sleep duration context: under 7h asleep is a deficit. Time-in-bed minus time-asleep over 1.5h suggests poor sleep quality.
- Sleep stage context: deep sleep under 60min/night is low (90min+ is good); REM under 80min/night is low (100min+ is good); awake over 30min/night suggests fragmented sleep.
- Keep it under 400 words total.
- No nested bullet points — short punchy sentences only.
- Do not add a preamble or sign-off.`

// Returns "↑ 12% vs earlier" or "↓ 8% vs earlier" if trend is >5%, otherwise null.
function detectTrend(daily: Array<{ date: string }>, getValue: (d: typeof daily[0]) => number): string | null {
  if (daily.length < 14) return null
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-7)
  const earlier = sorted.slice(0, sorted.length - 7)
  const recentAvg = recent.reduce((s, d) => s + getValue(d), 0) / recent.length
  const earlierAvg = earlier.reduce((s, d) => s + getValue(d), 0) / earlier.length
  if (earlierAvg === 0) return null
  const pct = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100)
  if (Math.abs(pct) < 5) return null
  return pct > 0 ? `↑ ${pct}% vs earlier` : `↓ ${Math.abs(pct)}% vs earlier`
}

function buildHealthSummary(health: HealthPayload): string {
  const lines: string[] = [`Period: last ${health.period_days ?? 30} days`]

  if (health.steps) {
    const trend = health.steps.daily
      ? detectTrend(health.steps.daily, (d) => (d as { count: number }).count)
      : null
    lines.push(`Steps: avg ${health.steps.average.toLocaleString()}/day, total ${health.steps.total.toLocaleString()}${trend ? ` (${trend})` : ''}`)
  }

  if (health.sleep) {
    const { average_hours_asleep, average_hours_in_bed, avg_deep_minutes, avg_rem_minutes, avg_awake_minutes, daily } = health.sleep
    const trend = daily ? detectTrend(daily, (d) => (d as { hours_asleep: number }).hours_asleep) : null
    const stages = [
      avg_deep_minutes != null ? `deep ${avg_deep_minutes}min` : null,
      avg_rem_minutes != null ? `REM ${avg_rem_minutes}min` : null,
      avg_awake_minutes != null ? `awake ${avg_awake_minutes}min` : null,
    ].filter(Boolean).join(', ')
    const stageStr = stages ? ` | ${stages}` : ''
    lines.push(`Sleep: avg ${average_hours_asleep.toFixed(1)}h asleep, ${average_hours_in_bed?.toFixed(1) ?? '—'}h in bed${trend ? ` (${trend})` : ''}${stageStr}`)
  }

  if (health.heart_rate) {
    const trend = health.heart_rate.daily_resting
      ? detectTrend(health.heart_rate.daily_resting, (d) => (d as { bpm: number }).bpm)
      : null
    lines.push(`Resting heart rate: avg ${health.heart_rate.resting_average} bpm${trend ? ` (${trend})` : ''}`)
  }

  if (health.hrv_ms) {
    const trend = health.hrv_ms.daily
      ? detectTrend(health.hrv_ms.daily, (d) => (d as { ms: number }).ms)
      : null
    lines.push(`HRV: avg ${health.hrv_ms.average} ms${trend ? ` (${trend})` : ''}`)
  }

  if (health.vo2_max_ml_kg_min != null) {
    lines.push(`VO2 max: ${health.vo2_max_ml_kg_min} ml/kg/min`)
  }

  if (health.active_energy) {
    const trend = health.active_energy.daily
      ? detectTrend(health.active_energy.daily, (d) => (d as { kcal: number }).kcal)
      : null
    lines.push(`Active energy burned: avg ${health.active_energy.average} kcal/day${trend ? ` (${trend})` : ''}`)
  }

  if (health.exercise_minutes) {
    const trend = health.exercise_minutes.daily
      ? detectTrend(health.exercise_minutes.daily, (d) => (d as { minutes: number }).minutes)
      : null
    lines.push(`Exercise: avg ${health.exercise_minutes.average} min/day${trend ? ` (${trend})` : ''}`)
  }

  if (health.workouts?.length) {
    const types = [...new Set(health.workouts.map((w) => w.type))].join(', ')
    lines.push(`Workouts: ${health.workouts.length} sessions (${types})`)
  }

  if (health.stand_hours) {
    lines.push(`Stand hours: avg ${health.stand_hours.daily_average}/day`)
  }

  if (health.weight_kg) {
    const delta = health.weight_kg.change_30d
    const sign = delta >= 0 ? '+' : ''
    lines.push(`Weight: ${health.weight_kg.latest} kg (${sign}${delta} kg over 30 days)`)
  }

  return lines.join('\n')
}

export async function analyzeHealth(health: HealthPayload, name?: string): Promise<string> {
  const summary = buildHealthSummary(health)
  const addressee = name ? `${name}'s` : 'this person\'s'

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 800,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Here is ${addressee} Apple Health data for the last 30 days:\n\n${summary}\n\nGive an honest analysis.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text
}
