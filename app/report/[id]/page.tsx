import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getReportById } from '@/lib/supabase'
import { computeDayOverDay } from '@/lib/dayOverDay'
import { computeScores } from '@/lib/scores'
import { buildVerdict } from '@/lib/verdict'
import DayOverDayCard from '@/app/components/DayOverDayCard'
import Analysis, { VerdictLine } from '@/app/components/Analysis'

export const metadata: Metadata = {
  title: 'True Mirror — Analysis',
  description: 'A personal health analysis from True Mirror.',
}

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const INK = '#1a1a18'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const CARD = '#fffdf9'
const BORDER = '#e7e2d8'

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await getReportById(id)
  if (!report) notFound()

  const dayOverDay = computeDayOverDay(report.raw_data)
  const verdict = buildVerdict(computeScores(report.raw_data))

  const date = new Date(report.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main style={{ fontFamily: SANS, maxWidth: 600, margin: '0 auto', padding: '44px 24px 80px', color: INK }}>
      <style>{`@keyframes tmFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>

      <div style={{ animation: 'tmFadeUp .5s ease both' }}>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 4px' }}>True Mirror</p>
        <p style={{ fontFamily: SERIF, fontSize: 15, color: MUTED, margin: '0 0 20px' }}>{date}</p>
      </div>

      <article
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: '24px 24px 26px',
          animation: 'tmFadeUp .5s ease both',
          animationDelay: '.06s',
        }}
      >
        <VerdictLine text={verdict} size="lg" />
        <DayOverDayCard dod={dayOverDay} />
        <Analysis text={report.analysis} size="lg" />
      </article>

      <div
        style={{
          marginTop: 36,
          paddingTop: 24,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 15,
          color: MUTED,
          animation: 'tmFadeUp .5s ease both',
          animationDelay: '.12s',
        }}
      >
        <p style={{ margin: '0 0 14px' }}>Want an honest read on your own Apple Health data?</p>
        <a
          href="https://truemirror.paahulhq.com"
          style={{
            display: 'inline-block',
            background: ACCENT,
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 10,
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Get True Mirror →
        </a>
      </div>
    </main>
  )
}
