import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/supabase'
import type { RegisterRequest } from '@/lib/types'

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

  try {
    const user = await createUser(body.name.trim(), body.email?.trim())
    return NextResponse.json({ token: user.token })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
