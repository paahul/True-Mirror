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
  email?: string | null
  opt_in: boolean
}

export interface PublicReport {
  analysis: string
  created_at: string
}

export async function getUserByToken(token: string): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('id, name, token, email, opt_in')
    .eq('token', token)
    .single()

  return (data as User) ?? null
}

export async function createUser(name: string, email?: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email: email ?? null })
    .select('id, name, token, email, opt_in')
    .single()

  if (error || !data) throw new Error(`Failed to create user: ${error?.message}`)
  return data as User
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

export async function getReportById(id: string): Promise<PublicReport | null> {
  const { data } = await supabase
    .from('reports')
    .select('analysis, created_at')
    .eq('id', id)
    .single()

  return (data as PublicReport) ?? null
}
