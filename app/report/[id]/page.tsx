import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getReportById } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'True Mirror — Analysis',
  description: 'A personal health analysis from True Mirror.',
}

function renderAnalysis(text: string) {
  return text.split('\n').filter(Boolean).map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/)
    const content = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
    )
    const isHeader = line.startsWith('**') && parts.length >= 2
    return isHeader
      ? <h2 key={i} style={{ fontSize: 17, marginTop: 28, marginBottom: 6 }}>{parts[1]}</h2>
      : <p key={i} style={{ margin: '6px 0', lineHeight: 1.6 }}>{content}</p>
  })
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await getReportById(id)
  if (!report) notFound()

  const date = new Date(report.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 560,
      margin: '0 auto',
      padding: '40px 24px 80px',
      color: '#111',
    }}>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24, marginTop: 0 }}>
        True Mirror · {date}
      </p>

      <div>{renderAnalysis(report.analysis)}</div>

      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid #eee',
        fontSize: 14,
        color: '#555',
      }}>
        <p style={{ margin: '0 0 12px' }}>Want an analysis of your own health data?</p>
        <a
          href="https://truemirror.paahulhq.com"
          style={{
            display: 'inline-block',
            background: '#111',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Get True Mirror →
        </a>
      </div>
    </main>
  )
}
