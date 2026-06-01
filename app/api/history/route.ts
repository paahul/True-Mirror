import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, getReportsByUser } from '@/lib/supabase'
import { computeScores } from '@/lib/scores'
import type { HistoryResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token query param is required' }, { status: 401 })
  }

  try {
    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const reports = await getReportsByUser(user.id)

    const payload: HistoryResponse = {
      user: { name: user.name, mode: user.mode, opt_in: user.opt_in },
      // Scores aren't persisted — recompute them from each report's stored raw_data.
      reports: reports.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        analysis: r.analysis,
        scores: computeScores(r.raw_data),
      })),
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('History error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
