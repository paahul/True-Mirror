import { createClient } from '@supabase/supabase-js'
import type { HealthPayload, UserMode } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface User {
  id: string
  name: string
  token: string
  email?: string | null
  mode: UserMode
  opt_in: boolean
  timezone?: string | null
  charge_reminder: boolean
  charge_reminder_at?: string | null
  wear_reminder: boolean
  wear_reminder_at?: string | null
}

export interface PublicReport {
  analysis: string
  created_at: string
  raw_data: HealthPayload
}

export interface FullReport {
  id: string
  raw_data: HealthPayload
  analysis: string
  created_at: string
}

export async function getUserByToken(token: string): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('id, name, token, email, mode, opt_in, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at')
    .eq('token', token)
    .single()

  return (data as User) ?? null
}

export async function createUser(params: {
  name: string
  email?: string
  mode?: UserMode
  timezone?: string
  charge_reminder?: boolean
  charge_reminder_at?: string
  wear_reminder?: boolean
  wear_reminder_at?: string
}): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: params.name,
      email: params.email ?? null,
      mode: params.mode ?? 'curious',
      timezone: params.timezone ?? null,
      charge_reminder: params.charge_reminder ?? false,
      charge_reminder_at: params.charge_reminder_at ?? null,
      wear_reminder: params.wear_reminder ?? false,
      wear_reminder_at: params.wear_reminder_at ?? null,
    })
    .select('id, name, token, email, mode, opt_in, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at')
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
    .select('analysis, created_at, raw_data')
    .eq('id', id)
    .single()

  return (data as PublicReport) ?? null
}

export async function getReportsByUser(userId: string): Promise<FullReport[]> {
  const { data } = await supabase
    .from('reports')
    .select('id, raw_data, analysis, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data as FullReport[]) ?? []
}

export async function updateUser(
  userId: string,
  patch: { mode?: UserMode; opt_in?: boolean },
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('id, name, token, email, mode, opt_in, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at')
    .single()

  if (error || !data) throw new Error(`Failed to update user: ${error?.message}`)
  return data as User
}

export async function getUsersWithReminders(): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('id, name, token, email, mode, opt_in, timezone, charge_reminder, charge_reminder_at, wear_reminder, wear_reminder_at')
    .not('email', 'is', null)
    .or('charge_reminder.eq.true,wear_reminder.eq.true')

  return (data as User[]) ?? []
}
