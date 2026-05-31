import { createClient } from '@supabase/supabase-js'
import type { HealthPayload } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface User {
  token: string
  save_history: boolean
}

export async function getOrCreateUser(token?: string): Promise<User> {
  if (token) {
    const { data } = await supabase
      .from('users')
      .select('token, save_history')
      .eq('token', token)
      .single()

    if (data) return data as User
  }

  const { data, error } = await supabase
    .from('users')
    .insert({})
    .select('token, save_history')
    .single()

  if (error || !data) throw new Error(`Failed to create user: ${error?.message}`)
  return data as User
}

export async function saveReport(
  userToken: string,
  analysis: string,
  health: HealthPayload,
): Promise<{ id: string }> {
  const metrics = {
    steps_avg: health.steps?.average,
    sleep_avg_hours: health.sleep?.average_hours_asleep,
    resting_hr: health.heart_rate?.resting_average,
    active_energy_avg: health.active_energy?.average,
    exercise_min_avg: health.exercise_minutes?.average,
    workout_count: health.workouts?.length ?? 0,
    weight_kg: health.weight_kg?.latest,
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({ user_token: userToken, analysis, metrics })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to save report: ${error?.message}`)
  return data as { id: string }
}
