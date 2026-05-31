import { NextRequest, NextResponse } from 'next/server'
import { analyzeHealth } from '@/lib/claude'
import { getUserByToken, saveReport } from '@/lib/supabase'
import type { AnalyzeRequest } from '@/lib/types'

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

  if (!body?.health) {
    return NextResponse.json({ error: 'health field is required' }, { status: 400 })
  }

  try {
    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { save_history = true, health } = body
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

    return NextResponse.json({
      token: user.token,
      analysis,
      report_id: reportId,
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
