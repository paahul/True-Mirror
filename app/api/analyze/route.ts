import { NextRequest, NextResponse } from 'next/server'
import { analyzeHealth } from '@/lib/claude'
import { getUserByToken, saveReport } from '@/lib/supabase'
import { normalizeFlatMetrics } from '@/lib/normalize'
import type { AnalyzeRequest } from '@/lib/types'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://truemirror.paahulhq.com'

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  console.log('[analyze] HIT token=', token ? token.slice(0, 8) : 'none')
  if (!token) {
    return NextResponse.json({ error: 'token query param is required' }, { status: 401 })
  }

  let body: AnalyzeRequest
  try {
    const rawText = await req.text()
    console.log('[analyze] body bytes=', rawText.length, 'preview=', rawText.slice(0, 300))
    body = JSON.parse(rawText)
  } catch (e) {
    console.log('[analyze] JSON parse failed:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Accept any of: a nested `health` payload (tests/back-compat), a flat `metrics`
  // bag, or flat metric keys at the top level of the body (simplest for the Shortcut).
  let health = body?.health
  if (!health) {
    const bag =
      (body?.metrics as Record<string, unknown>) ??
      (body as Record<string, unknown> | undefined) ??
      {}
    health = normalizeFlatMetrics(bag)
    // require at least one real metric beyond the default period_days
    if (Object.keys(health).length <= 1) {
      return NextResponse.json({ error: 'no usable metrics provided' }, { status: 400 })
    }
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
