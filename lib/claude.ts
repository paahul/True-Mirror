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
- Keep it under 400 words total.
- No nested bullet points — short punchy sentences only.
- Do not add a preamble or sign-off.`

function buildHealthSummary(health: HealthPayload): string {
  const lines: string[] = [`Period: last ${health.period_days ?? 30} days`]

  if (health.steps) {
    lines.push(`Steps: avg ${health.steps.average.toLocaleString()}/day, total ${health.steps.total.toLocaleString()}`)
  }
  if (health.sleep) {
    const asleep = health.sleep.average_hours_asleep.toFixed(1)
    const inBed = health.sleep.average_hours_in_bed?.toFixed(1) ?? '—'
    lines.push(`Sleep: avg ${asleep}h asleep, ${inBed}h in bed`)
  }
  if (health.heart_rate) {
    lines.push(`Resting heart rate: avg ${health.heart_rate.resting_average} bpm`)
  }
  if (health.active_energy) {
    lines.push(`Active energy burned: avg ${health.active_energy.average} kcal/day`)
  }
  if (health.exercise_minutes) {
    lines.push(`Exercise: avg ${health.exercise_minutes.average} min/day`)
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

export async function analyzeHealth(health: HealthPayload): Promise<string> {
  const summary = buildHealthSummary(health)

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
        content: `Here is my Apple Health data for the last 30 days:\n\n${summary}\n\nGive me your honest analysis.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text
}
