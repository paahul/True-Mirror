'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { HistoryResponse, HistoryReport, UserMode } from '@/lib/types'
import { buildVerdict } from '@/lib/verdict'
import DayOverDayCard from '@/app/components/DayOverDayCard'
import Analysis, { AnalysisSection, parseAnalysis, sectionTint, type Kind } from '@/app/components/Analysis'

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

// Trends only make sense once there's enough history to be a trend, not noise.
// Bump to 30 for a stricter gate.
const MIN_TREND_SPAN_DAYS = 14

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

// Just a link to the standalone report page — used on earlier-summary cards so
// you can open the full past analysis. (No copy-link; the page lives in a browser.)
function ShareRow({ id }: { id: string }) {
  return (
    <a href={`/report/${id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, color: ACCENT, textDecoration: 'none', fontWeight: 500, fontSize: 13 }}>
      Open full analysis ↗
    </a>
  )
}

// Swipeable deck of past reports — one summary card at a time, with a position
// anchor (counter + dots) up top. Native scroll-snap = real swipe feel on phones.
function ReportDeck({ reports }: { reports: HistoryReport[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const n = reports.length

  const step = () => {
    const el = scroller.current
    const first = el?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + 12 : el?.clientWidth ?? 1
  }
  const onScroll = () => {
    const el = scroller.current
    if (el) setIdx(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step()))))
  }
  const goTo = (i: number) => scroller.current?.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * step(), behavior: 'smooth' })

  const arrow = (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, background: '#fff',
    color: disabled ? '#cfc9bd' : ACCENT, cursor: disabled ? 'default' : 'pointer', fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  })

  return (
    <div>
      {/* Position anchor */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{idx + 1} of {n}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {n <= 8 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {reports.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to analysis ${i + 1}`}
                  style={{ width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: i === idx ? ACCENT : '#d8d2c6', transition: 'background .2s' }}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Previous" style={arrow(idx === 0)}>‹</button>
            <button onClick={() => goTo(idx + 1)} disabled={idx === n - 1} aria-label="Next" style={arrow(idx === n - 1)}>›</button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="tm-deck"
        style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', paddingBottom: 2 }}
      >
        {reports.map((r) => {
          const v = buildVerdict(r.scores)
          return (
            <div
              key={r.id}
              style={{ flex: '0 0 86%', scrollSnapAlign: 'center', boxSizing: 'border-box', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}
            >
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{longDate(r.created_at)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {r.scores.recovery != null && <ScoreChip label="Recovery" value={String(r.scores.recovery)} color={recoveryColor(r.scores.recovery)} />}
                {r.scores.sleep != null && <ScoreChip label="Sleep" value={String(r.scores.sleep)} color={sleepColor(r.scores.sleep)} />}
                {r.scores.strain != null && <ScoreChip label="Strain" value={String(r.scores.strain)} color={STRAIN} />}
                {r.scores.stress != null && <ScoreChip label="Stress" value={r.scores.stress} color={stressColor(r.scores.stress)} />}
              </div>
              {v && <p style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.4, color: INK, margin: '0 0 12px' }}>{v}</p>}
              <ShareRow id={r.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The dark "cover" card: scores rings + stress + the verdict (tinted by recovery).
function CoverCard({ latest, prev }: { latest: HistoryReport; prev: HistoryReport | null }) {
  const sc = latest.scores
  const d = (a?: number | null, b?: number | null) => (a != null && b != null ? a - b : null)
  const dc = (x: number | null) => (x == null ? '#aeb6ae' : x > 0 ? '#4ade80' : '#f87171')
  const v = buildVerdict(sc)
  const vColor = sc.recovery == null ? '#fbf7f0' : sc.recovery >= 70 ? '#5fe3a1' : sc.recovery >= 40 ? '#f5c451' : '#f88b8b'
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80d6b7', fontWeight: 700, textAlign: 'center' }}>
        Today&rsquo;s read · {shortDate(latest.created_at)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
        {sc.recovery != null && <Ring value={sc.recovery} color={recoveryColor(sc.recovery)} label="Recovery" delta={d(sc.recovery, prev?.scores.recovery)} deltaColor={dc(d(sc.recovery, prev?.scores.recovery))} dark />}
        {sc.sleep != null && <Ring value={sc.sleep} color={sleepColor(sc.sleep)} label="Sleep" delta={d(sc.sleep, prev?.scores.sleep)} deltaColor={dc(d(sc.sleep, prev?.scores.sleep))} dark />}
        {sc.strain != null && <Ring value={sc.strain} color="#7fb8cc" label="Strain" delta={d(sc.strain, prev?.scores.strain)} deltaColor="#aeb6ae" dark />}
      </div>
      {sc.stress != null && <div style={{ textAlign: 'center' }}><StressPill level={sc.stress} dark /></div>}
      {v && <p style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.32, fontWeight: 600, color: vColor, margin: 0, textAlign: 'center' }}>{v}</p>}
      <p style={{ fontSize: 12, color: '#9fb3a8', textAlign: 'center', margin: 0 }}>Swipe to read your full analysis →</p>
    </div>
  )
}

// One "Three things to do this week" action as its own focused flashcard.
function ActionFace({ index, total, text }: { index: number; total: number; text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700 }}>
        This week · {index} of {total}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>{index}</span>
        <p style={{ fontFamily: SERIF, fontSize: 23, lineHeight: 1.32, color: INK, margin: 0 }}>{text}</p>
      </div>
    </div>
  )
}

interface DeckCard { key: string; node: React.ReactNode; bg: string; accent: string; dark?: boolean }

// The whole read as one stacked swipe deck. Card 1 is the cover; swipe (or fling,
// or tap ›) to reveal the next. Progress bar + counter anchor you to the set.
function Deck({ cards }: { cards: DeckCard[] }) {
  const n = cards.length
  const [i, setI] = useState(0)
  const [dx, setDx] = useState(0)
  const [flyMs, setFlyMs] = useState(360)
  const dragging = useRef(false)
  const startX = useRef(0)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const vel = useRef(0)
  const THRESH = 64
  const VTHRESH = 0.5 // px/ms — a fast flick advances even on a short drag

  const cardBox = (card: DeckCard, extra: React.CSSProperties): React.CSSProperties => ({
    background: card.bg,
    border: card.dark ? '1px solid rgba(255,255,255,0.10)' : `1px solid ${BORDER}`,
    borderLeft: `3px solid ${card.accent}`,
    borderRadius: 16,
    padding: '20px 18px',
    boxShadow: '0 16px 36px -16px rgba(20,40,32,.5)',
    ...extra,
  })

  if (n === 1) return <div style={cardBox(cards[0], {})}>{cards[0].node}</div>

  const goTo = (k: number) => {
    const j = Math.max(0, Math.min(n - 1, k))
    if (j !== i) { navigator.vibrate?.(6); setFlyMs(360); setI(j) }
  }
  const onDown = (e: React.PointerEvent) => {
    dragging.current = true; startX.current = e.clientX; lastX.current = e.clientX; lastT.current = performance.now(); vel.current = 0
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const now = performance.now(), dt = now - lastT.current
    if (dt > 0) vel.current = (e.clientX - lastX.current) / dt
    lastX.current = e.clientX; lastT.current = now
    setDx(e.clientX - startX.current)
  }
  const end = () => {
    if (!dragging.current) return
    dragging.current = false
    const v = vel.current, fast = Math.abs(v) > VTHRESH
    if ((dx <= -THRESH || (fast && v < 0)) && i < n - 1) { navigator.vibrate?.(6); setFlyMs(fast ? 190 : 340); setI(i + 1) }
    else if (dx >= THRESH && i > 0) { navigator.vibrate?.(6); setFlyMs(340); setI(i - 1) }
    setDx(0)
  }

  const cardStyle = (off: number, card: DeckCard): React.CSSProperties => {
    const progress = Math.min(Math.abs(dx) / 280, 1) // 0→1 as the top card is dragged
    const dur = off < 0 ? flyMs : 360
    const base = cardBox(card, {
      position: 'absolute', inset: 0, overflowY: 'auto', boxSizing: 'border-box',
      transition: dragging.current ? 'none' : `transform ${dur}ms cubic-bezier(.2,.8,.2,1), opacity ${dur}ms`,
      touchAction: 'pan-y',
    })
    // Behind cards peek via centred scale and RISE toward full size as you drag.
    if (off < 0) return { ...base, transform: 'translateX(-130%) rotate(-10deg)', opacity: 0, zIndex: 1, pointerEvents: 'none' }
    if (off === 0) return { ...base, transform: `translateX(${dx}px) rotate(${dx * 0.04}deg)`, zIndex: 30, cursor: 'grab', animation: i === 0 && !dragging.current && dx === 0 ? 'tmNudge 1.15s ease 0.8s 1' : undefined }
    if (off === 1) return { ...base, transform: `scale(${0.955 + 0.045 * progress})`, opacity: 0.6 + 0.4 * progress, zIndex: 20, pointerEvents: 'none' }
    if (off === 2) return { ...base, transform: `scale(${0.91 + 0.045 * progress})`, opacity: 0.34 + 0.28 * progress, zIndex: 10, pointerEvents: 'none' }
    return { ...base, transform: 'scale(0.91)', opacity: 0, zIndex: 0, pointerEvents: 'none' }
  }

  const arrow = (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, background: '#fff',
    color: disabled ? '#cfc9bd' : ACCENT, cursor: disabled ? 'default' : 'pointer', fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  })

  return (
    <div>
      {/* Stories-style progress bar + counter + arrows */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {cards.map((_, k) => (
            <button key={k} onClick={() => goTo(k)} aria-label={`Card ${k + 1}`} style={{ flex: 1, height: 4, borderRadius: 2, border: 'none', padding: 0, cursor: 'pointer', background: k <= i ? ACCENT : '#e2dcd0', transition: 'background .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
          <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{i + 1} of {n}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => goTo(i - 1)} disabled={i === 0} aria-label="Previous" style={arrow(i === 0)}>‹</button>
            <button onClick={() => goTo(i + 1)} disabled={i === n - 1} aria-label="Next" style={arrow(i === n - 1)}>›</button>
          </div>
        </div>
      </div>

      {/* Clip layer (shadow room + contains fly-out) → relative stack */}
      <div style={{ overflow: 'hidden', padding: '12px 16px 30px', margin: '0 -16px' }}>
        <div style={{ position: 'relative', height: 'clamp(340px, 56vh, 560px)' }}>
          {cards.map((card, k) => {
            const off = k - i
            const active = off === 0
            return (
              <div
                key={card.key}
                onPointerDown={active ? onDown : undefined}
                onPointerMove={active ? onMove : undefined}
                onPointerUp={active ? end : undefined}
                onPointerCancel={active ? end : undefined}
                onPointerLeave={active ? end : undefined}
                style={cardStyle(off, card)}
              >
                {card.node}
              </div>
            )
          })}
        </div>
      </div>

      {i < n - 1 && (
        <p style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 2 }}>Swipe for the next →</p>
      )}
    </div>
  )
}

const keyframes = `
@keyframes tmFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes tmFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tmDraw { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
@keyframes tmNudge { 0%,100% { transform: translateX(0) rotate(0); } 55% { transform: translateX(-24px) rotate(-2deg); } 78% { transform: translateX(7px) rotate(.6deg); } }
.tm-deck::-webkit-scrollbar { display: none; }
`

export default function HistoryClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingSetting, setSavingSetting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showEarlier, setShowEarlier] = useState(false)

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
  const spanDays =
    chrono.length >= 2
      ? (new Date(chrono[chrono.length - 1].created_at).getTime() - new Date(chrono[0].created_at).getTime()) / 86_400_000
      : 0
  const showTrends = spanDays >= MIN_TREND_SPAN_DAYS && (recoveryPts.length >= 2 || sleepPts.length >= 2)

  const latest = data.reports[0] ?? null
  const prev = data.reports[1] ?? null

  let section = -1
  const anim = (extra = 0) => ({ animation: 'tmFadeUp .5s ease both', animationDelay: `${(++section) * 0.07 + extra}s` })

  return wrap(
    <>
      <div style={anim()}>{heading(data.user.name)}</div>

      {/* The whole read as one swipe deck: cover (scores + verdict) → day-over-day → sections */}
      {latest && (() => {
        const sections = parseAnalysis(latest.analysis).sections
        const KICK: Record<Kind, string> = { good: 'Strengths', warn: 'Watch-outs', actions: 'This week', list: 'Notes' }
        const deckCards: DeckCard[] = [
          { key: 'cover', dark: true, accent: '#2f9e80', bg: 'radial-gradient(130% 150% at 50% -10%, #21342c 0%, #121c17 72%)', node: <CoverCard latest={latest} prev={prev} /> },
        ]
        if (latest.day_over_day) deckCards.push({ key: 'dod', accent: ACCENT, bg: '#fffdf9', node: <DayOverDayCard dod={latest.day_over_day} framed={false} /> })
        if (sections.length) {
          sections.forEach((sec, k) => {
            const t = sectionTint(sec.kind)
            if (sec.kind === 'actions') {
              // Each action becomes its own flashcard — the read's climax.
              const items = sec.body
                .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, '').replace(/\*\*/g, '').trim())
                .filter(Boolean)
              items.forEach((txt, a) => {
                deckCards.push({ key: `a${k}-${a}`, accent: t.accent, bg: t.bg, node: <ActionFace index={a + 1} total={items.length} text={txt} /> })
              })
            } else {
              deckCards.push({ key: `s${k}`, accent: t.accent, bg: t.bg, node: <AnalysisSection section={sec} metrics={latest.metrics} framed={false} size="lg" kicker={KICK[sec.kind]} /> })
            }
          })
        } else {
          deckCards.push({ key: 'full', accent: ACCENT, bg: '#fffdf9', node: <Analysis text={latest.analysis} metrics={latest.metrics} /> })
        }
        return (
          <section style={{ margin: '22px 0 26px', ...anim() }}>
            <Deck cards={deckCards} />
          </section>
        )
      })()}

      {/* Trends — only once there's enough history to be meaningful */}
      {showTrends && (
        <section style={{ marginBottom: 26, ...anim() }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Trends</h2>
          <ScoreChart title="Recovery" points={recoveryPts} color={GREEN} />
          <ScoreChart title="Sleep" points={sleepPts} color={SLEEP_BLUE} />
        </section>
      )}

      {/* Footer — utilities kept quiet so the read owns the page */}
      <footer style={{ marginTop: 36, borderTop: `1px solid ${BORDER}`, ...anim() }}>
        <button
          onClick={() => setShowSettings((o) => !o)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '14px 0', cursor: 'pointer', fontSize: 14, color: MUTED }}
        >
          <span>Tell us how you use your Watch</span>
          <span style={{ fontSize: 16, color: ACCENT, transform: showSettings ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
        </button>
        {showSettings && (
          <div style={{ padding: '0 0 16px' }}>
            <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 10px' }}>Sharpens your coaching to how you actually train.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {(Object.keys(MODE_LABELS) as UserMode[]).map((m) => {
                const active = data.user.mode === m
                return (
                  <button
                    key={m}
                    disabled={savingSetting}
                    onClick={() => !active && updateSetting({ mode: m })}
                    style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`, background: active ? ACCENT : '#fff', color: active ? '#fff' : '#444', cursor: active ? 'default' : 'pointer', transition: 'all .2s ease' }}
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
          </div>
        )}

        {data.reports.length > 1 && (
          <>
            <div style={{ borderTop: `1px solid ${BORDER}` }} />
            <button
              onClick={() => setShowEarlier((o) => !o)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '14px 0', cursor: 'pointer', fontSize: 14, color: MUTED }}
            >
              <span>Earlier analyses <span style={{ color: '#a39e93' }}>({data.reports.length - 1})</span></span>
              <span style={{ fontSize: 16, color: ACCENT, transform: showEarlier ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
            </button>
            {showEarlier && <div style={{ paddingBottom: 16 }}><ReportDeck reports={data.reports.slice(1)} /></div>}
          </>
        )}
      </footer>

      {data.reports.length === 0 && (
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, ...anim() }}>
          No analyses yet. Run the Shortcut to get your first one — it&rsquo;ll show up here.
        </p>
      )}
    </>,
  )
}
