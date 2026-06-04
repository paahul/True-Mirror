import type { HealthScores } from './types'

// A one-line synthesis of today's state, shown as the headline above the
// narrative. Deterministic (derived from the computed scores), so it renders
// on every report retroactively — same philosophy as the day-over-day card.
// The narrative carries the nuance; this is just the at-a-glance read.
export function buildVerdict(scores: HealthScores): string | null {
  const { recovery, sleep, strain, stress } = scores
  if (recovery == null) return null // recovery is the spine of the read; without it, skip

  let state: string
  if (recovery >= 70) state = 'Well recovered'
  else if (recovery >= 55) state = 'Moderately recovered'
  else if (recovery >= 40) state = 'Partially recovered'
  else state = 'Under-recovered'

  if (sleep != null && sleep < 50) state += ' but under-slept'
  if (stress === 'high') state += ', stress running high'

  let advice: string
  if (recovery < 40) advice = 'make today easy'
  else if (strain != null && strain > 60 && recovery < 55) advice = 'prioritise recovery today'
  else if (recovery >= 70 && stress !== 'high') advice = "you've got room to push"
  else advice = 'keep today moderate'

  return `${state} — ${advice}.`
}
