'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { HistoryResponse, HistoryReport, UserMode } from '@/lib/types'
import { buildVerdict } from '@/lib/verdict'
import DayOverDayCard from '@/app/components/DayOverDayCard'
import Analysis, { VerdictLine } from '@/app/components/Analysis'

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const INK = '#1a1a18'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const CARD = '#fffdf9'
const BORDER = '#e7e2d8'
const TRACK = '#ece8e0'

const RED = '#e5484d'
const AMBER = '#f5a623'
const GREEN = '#30a46c'
const SLEEP_BLUE = '#3b82f6'
const STRAIN = '#7c8597'

const MODE_LABELS: Record<UserMode, string> = {
  curious: 'Just curious',
  active: 'Building active habits',
  performance: 'Serious training',
}

function recoveryColor(v: number) {
  return v < 40 ? RED : v > 70 ? GREEN : AMBER
}
function sleepColor(v: number) {
  return v < 50 ? RED : v > 75 ? GREEN : AMBER
}
function stressColor(level: 'low' | 'moderate' | 'high') {
  return level === 'low' ? GREEN : level === 'moderate' ? AMBER : RED
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// --- Animated circular gauge (with count-up + glow; dark variant) -----------
function Ring({
  value,
  color,
  label,
  delta,
  deltaColor,
  dark = false,
}: {
  value: number
  color: string
  label: string
  delta: number | null
  deltaColor: string
  dark?: boolean
}) {
  const R = 36
  const SW = 8
  const C = 2 * Math.PI * R
  const BOX = (R + SW) * 2 + 6
  const pct = Math.max(0, Math.min(value, 100)) / 100
  const [off, setOff] = useState(C)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setOff(C * (1 - pct)), 80)
    let raf = 0
    const dur = 950
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [C, pct, value])

  return (
    <div style={{ textAlign: 'center', minWidth: 96 }}>
      <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} style={{ display: 'block', margin: '0 auto' }}>
        <circle cx={BOX / 2} cy={BOX / 2} r={R} fill="none" stroke={dark ? 'rgba(255,255,255,0.12)' : TRACK} strokeWidth={SW} />
        <circle
          cx={BOX / 2}
          cy={BOX / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)', filter: dark ? `drop-shadow(0 0 6px ${color})` : 'none' }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, fill: dark ? '#fbf7f0' : INK }}
        >
          {shown}
        </text>
      </svg>
      <div style={{ fontSize: 13, color: dark ? '#cfd6cf' : INK, marginTop: 7, fontWeight: 500 }}>{label}</div>
      {delta != null && delta !== 0 && (
        <div style={{ fontSize: 11.5, color: deltaColor, fontWeight: 600, marginTop: 2 }}>
          {delta > 0 ? '↑' : '↓'}{Math.abs(delta)} vs last
        </div>
      )}
    </div>
  )
}

function StressPill({ level, dark = false }: { level: 'low' | 'moderate' | 'high'; dark?: boolean }) {
  const c = stressColor(level)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 13,
        color: dark ? '#e9e4da' : INK,
        background: dark ? 'rgba(255,255,255,0.07)' : CARD,
        border: dark ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${BORDER}`,
        borderRadius: 999,
        padding: '6px 14px',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: dark ? `0 0 6px ${c}` : 'none' }} />
      Stress <strong style={{ color: c, textTransform: 'capitalize' }}>{level}</strong>
    </span>
  )
}

interface ChartPoint {
  date: string
  value: number
}

// SVG line chart with gradient area fill, endpoint label, and a draw-in animation.
function ScoreChart({ title, points, color }: { title: string; points: ChartPoint[]; color: string }) {
  if (points.length < 2) return null
  const W = 520
  const H = 150
  const padX = 14
  const padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const n = points.length
  const x = (i: number) => padX + (i / (n - 1)) * innerW
  const y = (v: number) => padY + innerH - (Math.max(0, Math.min(v, 100)) / 100) * innerH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${padX} ${(padY + innerH).toFixed(1)} Z`
  const latest = points[n - 1].value
  const gid = `grad-${title}`

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{title}</span>
        <span style={{ fontFamily: SERIF, fontSize: 18, color, fontWeight: 600 }}>{latest}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10 }}
        aria-label={`${title} trend`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((g) => (
          <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#efe9df" strokeWidth={1} />
        ))}
        <path d={area} fill={`url(#${gid})`} style={{ animation: 'tmFade .9s ease both' }} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={1400}
          style={{ animation: 'tmDraw 1.1s cubic-bezier(.3,.8,.3,1) both' }}
        />
        <circle cx={x(n - 1)} cy={y(latest)} r={4} fill={color} style={{ animation: 'tmFade 1.2s ease both' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>{shortDate(points[0].date)}</span>
        <span style={{ fontSize: 11, color: '#aaa' }}>{shortDate(points[n - 1].date)}</span>
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
        background: '#f4f1ea',
        borderRadius: 6,
        padding: '3px 8px',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {label} <strong style={{ fontWeight: 600 }}>{value}</strong>
    </span>
  )
}

function ShareRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(`${window.location.origin}/report/${id}`).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }, [id])
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 13, marginTop: 14 }}>
      <a href={`/report/${id}`} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>
        Open ↗
      </a>
      <button onClick={copy} style={{ background: 'none', border: 'none', padding: 0, color: MUTED, cursor: 'pointer', fontSize: 13 }}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  )
}

function PastCard({ report }: { report: HistoryReport }) {
  const [open, setOpen] = useState(false)
  const { scores } = report
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{longDate(report.created_at)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {scores.recovery != null && <ScoreChip label="Recovery" value={String(scores.recovery)} color={recoveryColor(scores.recovery)} />}
        {scores.sleep != null && <ScoreChip label="Sleep" value={String(scores.sleep)} color={sleepColor(scores.sleep)} />}
        {scores.strain != null && <ScoreChip label="Strain" value={String(scores.strain)} color={STRAIN} />}
        {scores.stress != null && <ScoreChip label="Stress" value={scores.stress} color={stressColor(scores.stress)} />}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ background: 'none', border: 'none', padding: 0, color: INK, cursor: 'pointer', fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}
        >
          {open ? 'Hide analysis' : 'Show analysis'}
        </button>
        <a href={`/report/${report.id}`} target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: 'none' }}>
          Open ↗
        </a>
      </div>
      {open && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <DayOverDayCard dod={report.day_over_day} />
          <Analysis text={report.analysis} metrics={report.metrics} size="sm" />
        </div>
      )}
    </div>
  )
}

const keyframes = `
@keyframes tmFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes tmFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tmDraw { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
`

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
      .then((json) => !cancelled && setData(json))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token])

  const updateSetting = useCallback(
    async (patch: { mode?: UserMode; opt_in?: boolean }) => {
      if (!token || !data) return
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
        setData((d) => (d ? { ...d, user: prev } : d))
      } finally {
        setSavingSetting(false)
      }
    },
    [token, data],
  )

  const wrap = (children: React.ReactNode) => (
    <main style={{ fontFamily: SANS, maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px', color: INK }}>
      <style>{keyframes}</style>
      {children}
    </main>
  )

  const heading = (sub: string) => (
    <>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 4px' }}>True Mirror</p>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, margin: '0 0 4px' }}>Your history</h1>
      {sub && <p style={{ color: MUTED, marginTop: 0 }}>{sub}</p>}
    </>
  )

  if (!token) {
    return wrap(
      <>
        {heading('')}
        <p style={{ color: MUTED, lineHeight: 1.6 }}>
          This page needs your personal link. Open it from your Shortcut, or add{' '}
          <code style={{ background: '#f4f1ea', padding: '1px 5px', borderRadius: 4 }}>?token=…</code> to the URL.
        </p>
      </>,
    )
  }

  if (loading) {
    return wrap(
      <>
        {heading('')}
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: i === 0 ? 150 : 64,
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                animation: 'tmFade 1s ease-in-out infinite alternate',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </>,
    )
  }

  if (error) return wrap(<>{heading('')}<p style={{ color: RED }}>{error}</p></>)
  if (!data) return wrap(<>{heading('')}<p style={{ color: MUTED }}>No data.</p></>)

  const chrono = [...data.reports].reverse()
  const recoveryPts = chrono.filter((r) => r.scores.recovery != null).map((r) => ({ date: r.created_at, value: r.scores.recovery as number }))
  const sleepPts = chrono.filter((r) => r.scores.sleep != null).map((r) => ({ date: r.created_at, value: r.scores.sleep as number }))

  const latest = data.reports[0] ?? null
  const prev = data.reports[1] ?? null
  const delta = (a?: number | null, b?: number | null) => (a != null && b != null ? a - b : null)

  let section = -1
  const anim = (extra = 0) => ({ animation: 'tmFadeUp .5s ease both', animationDelay: `${(++section) * 0.07 + extra}s` })

  return wrap(
    <>
      <div style={anim()}>{heading(data.user.name)}</div>

      {/* Hero — latest read */}
      {latest && (
        <section
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            overflow: 'hidden',
            margin: '22px 0 26px',
            boxShadow: '0 10px 30px -18px rgba(20,40,32,0.5)',
            ...anim(),
          }}
        >
          {/* Dark scores panel */}
          <div style={{ background: 'radial-gradient(130% 150% at 50% -10%, #21342c 0%, #121c17 72%)', padding: '24px 22px 26px' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80d6b7', fontWeight: 600, marginBottom: 18, textAlign: 'center' }}>
              Latest · {longDate(latest.created_at)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center', marginBottom: latest.scores.stress != null ? 20 : 2 }}>
              {latest.scores.recovery != null && (
                <Ring
                  value={latest.scores.recovery}
                  color={recoveryColor(latest.scores.recovery)}
                  label="Recovery"
                  delta={delta(latest.scores.recovery, prev?.scores.recovery)}
                  deltaColor={(() => { const d = delta(latest.scores.recovery, prev?.scores.recovery); return d == null ? '#aeb6ae' : d > 0 ? '#4ade80' : '#f87171' })()}
                  dark
                />
              )}
              {latest.scores.sleep != null && (
                <Ring
                  value={latest.scores.sleep}
                  color={sleepColor(latest.scores.sleep)}
                  label="Sleep"
                  delta={delta(latest.scores.sleep, prev?.scores.sleep)}
                  deltaColor={(() => { const d = delta(latest.scores.sleep, prev?.scores.sleep); return d == null ? '#aeb6ae' : d > 0 ? '#4ade80' : '#f87171' })()}
                  dark
                />
              )}
              {latest.scores.strain != null && (
                <Ring
                  value={latest.scores.strain}
                  color="#7fb8cc"
                  label="Strain"
                  delta={delta(latest.scores.strain, prev?.scores.strain)}
                  deltaColor="#aeb6ae"
                  dark
                />
              )}
            </div>
            {latest.scores.stress != null && (
              <div style={{ textAlign: 'center' }}>
                <StressPill level={latest.scores.stress} dark />
              </div>
            )}
          </div>
          {/* Light analysis body */}
          <div style={{ padding: '18px 22px 22px' }}>
            <VerdictLine text={buildVerdict(latest.scores)} />
            <DayOverDayCard dod={latest.day_over_day} />
            <Analysis text={latest.analysis} metrics={latest.metrics} />
            <ShareRow id={latest.id} />
          </div>
        </section>
      )}

      {/* Settings */}
      <section style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 26, ...anim() }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, fontWeight: 500 }}>How you use your Watch</div>
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
                  border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  background: active ? ACCENT : '#fff',
                  color: active ? '#fff' : '#444',
                  cursor: active ? 'default' : 'pointer',
                  transition: 'all .2s ease',
                }}
              >
                {MODE_LABELS[m]}
              </button>
            )
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#444', cursor: 'pointer' }}>
          <input type="checkbox" checked={data.user.opt_in} disabled={savingSetting} onChange={(e) => updateSetting({ opt_in: e.target.checked })} style={{ width: 16, height: 16, accentColor: ACCENT }} />
          Save my analyses to track trends over time
        </label>
        {!data.user.opt_in && (
          <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0 26px' }}>History saving is off — new analyses won&rsquo;t be stored.</p>
        )}
      </section>

      {/* Trends */}
      {(recoveryPts.length >= 2 || sleepPts.length >= 2) && (
        <section style={{ marginBottom: 26, ...anim() }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Trends</h2>
          <ScoreChart title="Recovery" points={recoveryPts} color={GREEN} />
          <ScoreChart title="Sleep" points={sleepPts} color={SLEEP_BLUE} />
        </section>
      )}

      {/* Earlier analyses */}
      {data.reports.length > 1 && (
        <section style={anim()}>
          <h2 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Earlier analyses</h2>
          {data.reports.slice(1).map((r) => (
            <PastCard key={r.id} report={r} />
          ))}
        </section>
      )}

      {data.reports.length === 0 && (
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, ...anim() }}>
          No analyses yet. Run the Shortcut to get your first one — it&rsquo;ll show up here.
        </p>
      )}
    </>,
  )
}
