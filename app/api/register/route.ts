import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/supabase'
import type { RegisterRequest, UserMode } from '@/lib/types'

const VALID_MODES: UserMode[] = ['curious', 'active', 'performance']

export async function POST(req: NextRequest) {
  let body: RegisterRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const requiredCode = process.env.INVITE_CODE
  if (requiredCode && body.invite_code !== requiredCode) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
  }

  const mode = body.mode && VALID_MODES.includes(body.mode) ? body.mode : 'curious'

  try {
    const user = await createUser({
      name: body.name.trim(),
      email: body.email?.trim(),
      mode,
      timezone: body.timezone,
      charge_reminder: body.charge_reminder,
      charge_reminder_at: body.charge_reminder_at,
      wear_reminder: body.wear_reminder,
      wear_reminder_at: body.wear_reminder_at,
    })
    return NextResponse.json({ token: user.token })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
