import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, updateUser } from '@/lib/supabase'
import type { UpdateUserRequest, UserMode } from '@/lib/types'

const VALID_MODES: UserMode[] = ['curious', 'active', 'performance']

export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token query param is required' }, { status: 401 })
  }

  let body: UpdateUserRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: { mode?: UserMode; opt_in?: boolean } = {}
  if (body.mode !== undefined) {
    if (!VALID_MODES.includes(body.mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }
    patch.mode = body.mode
  }
  if (body.opt_in !== undefined) {
    if (typeof body.opt_in !== 'boolean') {
      return NextResponse.json({ error: 'opt_in must be a boolean' }, { status: 400 })
    }
    patch.opt_in = body.opt_in
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update (send mode and/or opt_in)' }, { status: 400 })
  }

  try {
    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const updated = await updateUser(user.id, patch)
    return NextResponse.json({ mode: updated.mode, opt_in: updated.opt_in })
  } catch (err) {
    console.error('User update error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
