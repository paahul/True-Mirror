import { createClient } from '@supabase/supabase-js'
import type { HealthPayload } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface User {
  id: string
  name: string
  token: string
  opt_in: boolean
}

export async function getUserByToken(token: string): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('id, name, token, opt_in')
    .eq('token', token)
    .single()

  return (data as User) ?? null
}

export async function saveReport(
  userId: string,
  analysis: string,
  rawData: HealthPayload,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('reports')
    .insert({ user_id: userId, analysis, raw_data: rawData })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to save report: ${error?.message}`)
  return data as { id: string }
}
