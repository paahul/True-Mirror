import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, getReportsByUser } from '@/lib/supabase'
import { computeScores } from '@/lib/scores'
import { computeDayOverDay } from '@/lib/dayOverDay'
import { computeMetricSnapshot } from '@/lib/metricSnapshot'
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
      // Scores / day-over-day / metric chips aren't persisted — recompute from each report's raw_data.
      reports: reports.map((r) => {
        const scores = computeScores(r.raw_data)
        const dod = computeDayOverDay(r.raw_data)
        return {
          id: r.id,
          created_at: r.created_at,
          analysis: r.analysis,
          scores,
          day_over_day: dod,
          metrics: computeMetricSnapshot(r.raw_data, scores, dod),
        }
      }),
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
