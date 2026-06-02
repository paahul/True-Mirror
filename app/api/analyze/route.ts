import { NextRequest, NextResponse } from 'next/server'
import { analyzeHealth } from '@/lib/claude'
import { getUserByToken, saveReport } from '@/lib/supabase'
import { normalizeFlatMetrics } from '@/lib/normalize'
import type { AnalyzeRequest } from '@/lib/types'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://truemirror.paahulhq.com'

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token query param is required' }, { status: 401 })
  }

  let body: AnalyzeRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Accept either a flat `metrics` bag (from the Shortcut) or a nested `health` payload.
  const health = body?.metrics ? normalizeFlatMetrics(body.metrics) : body?.health
  if (!health) {
    return NextResponse.json({ error: 'metrics or health field is required' }, { status: 400 })
  }

  try {
    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { save_history = true } = body
    const analysis = await analyzeHealth(health, user.name)

    let reportId: string | null = null
    if (save_history && user.opt_in) {
      try {
        const report = await saveReport(user.id, analysis, health)
        reportId = report.id
      } catch (err) {
        console.error('Failed to save report (non-fatal):', err)
      }
    }

    const shareUrl = reportId ? `${BASE_URL}/report/${reportId}` : null

    return NextResponse.json({
      token: user.token,
      analysis,
      report_id: reportId,
      share_url: shareUrl,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
