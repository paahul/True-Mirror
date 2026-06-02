'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { HistoryResponse, HistoryReport, UserMode } from '@/lib/types'

const MODE_LABELS: Record<UserMode, string> = {
  curious: 'Just curious',
  active: 'Building active habits',
  performance: 'Serious training',
}

const RED = '#e5484d'
const AMBER = '#f5a623'
const GREEN = '#30a46c'
const GREY = '#888'

function recoveryColor(v: number): string {
  if (v < 40) return RED
  if (v > 70) return GREEN
  return AMBER
}

function sleepColor(v: number): string {
  if (v < 50) return RED
  if (v > 75) return GREEN
  return AMBER
}

function stressColor(level: 'low' | 'moderate' | 'high'): string {
  return level === 'low' ? GREEN : level === 'moderate' ? AMBER : RED
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Renders the **bold header** / paragraph format the analysis uses (same as the report page).
function renderAnalysis(text: string) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/)
      const content = parts.map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
      )
      const isHeader = line.startsWith('**') && parts.length >= 2
      return isHeader ? (
        <h3 key={i} style={{ fontSize: 15, marginTop: 20, marginBottom: 4 }}>
          {parts[1]}
        </h3>
      ) : (
        <p key={i} style={{ margin: '6px 0', lineHeight: 1.6, fontSize: 14 }}>
          {content}
        </p>
      )
    })
}

interface ChartPoint {
  date: string
  value: number
}

// Minimal dependency-free SVG line chart on a fixed 0–100 scale.
function ScoreChart({
  title,
  points,
  color,
}: {
  title: string
  points: ChartPoint[]
  color: string
}) {
  if (points.length < 2) return null

  const W = 520
  const H = 140
  const padX = 12
  const padY = 18
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const n = points.length
  const x = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padY + innerH - (Math.max(0, Math.min(v, 100)) / 100) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
  const latest = points[points.length - 1].value

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 13, color, fontWeight: 600 }}>{latest}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', background: '#fafafa', borderRadius: 8 }}
        preserveAspectRatio="none"
        aria-label={`${title} trend chart`}
      >
        {/* gridlines at 0/50/100 */}
        {[0, 50, 100].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={y(g)}
            y2={y(g)}
            stroke="#eee"
            strokeWidth={1}
          />
        ))}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={color} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>{shortDate(points[0].date)}</span>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          {shortDate(points[points.length - 1].date)}
        </span>
      </div>
    </div>
  )
}

function ScoreChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        color: '#444',
        background: '#f4f4f5',
        borderRadius: 6,
        padding: '3px 8px',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {label} <strong style={{ fontWeight: 600 }}>{value}</strong>
    </span>
  )
}

function ReportCard({ report, defaultOpen = false }: { report: HistoryReport; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  const { scores } = report

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/report/${report.id}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }, [report.id])

  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>{longDate(report.created_at)}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {scores.recovery != null && (
          <ScoreChip label="Recovery" value={String(scores.recovery)} color={recoveryColor(scores.recovery)} />
        )}
        {scores.sleep != null && (
          <ScoreChip label="Sleep" value={String(scores.sleep)} color={sleepColor(scores.sleep)} />
        )}
        {scores.strain != null && <ScoreChip label="Strain" value={String(scores.strain)} color={GREY} />}
        {scores.stress != null && (
          <ScoreChip label="Stress" value={scores.stress} color={stressColor(scores.stress)} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#111',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'underline',
          }}
        >
          {open ? 'Hide analysis' : 'Show analysis'}
        </button>
        <a
          href={`/report/${report.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#555', textDecoration: 'none' }}
        >
          Open ↗
        </a>
        <button
          onClick={copyLink}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#555',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 4 }}>
          {renderAnalysis(report.analysis)}
        </div>
      )}
    </div>
  )
}

export default function HistoryClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingSetting, setSavingSetting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/history?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed (${res.status})`)
        }
        return res.json() as Promise<HistoryResponse>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const updateSetting = useCallback(
    async (patch: { mode?: UserMode; opt_in?: boolean }) => {
      if (!token || !data) return
      // optimistic update
      const prev = data.user
      setData({ ...data, user: { ...data.user, ...patch } })
      setSavingSetting(true)
      try {
        const res = await fetch(`/api/user?token=${encodeURIComponent(token)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error('save failed')
      } catch {
        // revert on failure
        setData((d) => (d ? { ...d, user: prev } : d))
      } finally {
        setSavingSetting(false)
      }
    },
    [token, data],
  )

  const wrap = (children: React.ReactNode) => (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 560,
        margin: '0 auto',
        padding: '40px 24px 80px',
        color: '#111',
      }}
    >
      {children}
    </main>
  )

  if (!token) {
    return wrap(
      <>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Your history</h1>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          This page needs your personal link. Open it from your Shortcut, or add{' '}
          <code style={{ background: '#f4f4f5', padding: '1px 5px', borderRadius: 4 }}>?token=…</code>{' '}
          to the URL.
        </p>
      </>,
    )
  }

  if (loading) return wrap(<p style={{ color: '#888' }}>Loading your history…</p>)

  if (error) {
    return wrap(
      <>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Your history</h1>
        <p style={{ color: RED }}>{error}</p>
      </>,
    )
  }

  if (!data) return wrap(<p style={{ color: '#888' }}>No data.</p>)

  // chronological points for charts (API returns newest-first)
  const chrono = [...data.reports].reverse()
  const recoveryPts = chrono
    .filter((r) => r.scores.recovery != null)
    .map((r) => ({ date: r.created_at, value: r.scores.recovery as number }))
  const sleepPts = chrono
    .filter((r) => r.scores.sleep != null)
    .map((r) => ({ date: r.created_at, value: r.scores.sleep as number }))

  return wrap(
    <>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 4px' }}>True Mirror</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Your history</h1>
      <p style={{ color: '#555', marginTop: 0 }}>{data.user.name}</p>

      {/* Settings */}
      <section
        style={{
          border: '1px solid #eee',
          borderRadius: 12,
          padding: 16,
          margin: '20px 0 28px',
        }}
      >
        <div style={{ fontSize: 13, color: '#555', marginBottom: 8, fontWeight: 500 }}>
          How you use your Watch
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {(Object.keys(MODE_LABELS) as UserMode[]).map((m) => {
            const active = data.user.mode === m
            return (
              <button
                key={m}
                disabled={savingSetting}
                onClick={() => !active && updateSetting({ mode: m })}
                style={{
                  fontSize: 13,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: active ? '1px solid #111' : '1px solid #ddd',
                  background: active ? '#111' : '#fff',
                  color: active ? '#fff' : '#444',
                  cursor: active ? 'default' : 'pointer',
                }}
              >
                {MODE_LABELS[m]}
              </button>
            )
          })}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#444',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={data.user.opt_in}
            disabled={savingSetting}
            onChange={(e) => updateSetting({ opt_in: e.target.checked })}
            style={{ width: 16, height: 16 }}
          />
          Save my analyses to track trends over time
        </label>
        {!data.user.opt_in && (
          <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0 26px' }}>
            History saving is off — new analyses won&rsquo;t be stored.
          </p>
        )}
      </section>

      {/* Charts */}
      {(recoveryPts.length >= 2 || sleepPts.length >= 2) && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Trends</h2>
          <ScoreChart title="Recovery" points={recoveryPts} color={GREEN} />
          <ScoreChart title="Sleep" points={sleepPts} color="#3b82f6" />
        </section>
      )}

      {/* Report list */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {data.reports.length} {data.reports.length === 1 ? 'analysis' : 'analyses'}
      </h2>
      {data.reports.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>
          No analyses yet. Run the Shortcut to get your first one — it&rsquo;ll show up here.
        </p>
      ) : (
        data.reports.map((r, i) => <ReportCard key={r.id} report={r} defaultOpen={i === 0} />)
      )}
    </>,
  )
}
