import type { DayOverDay, DayDelta } from '@/lib/types'

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const INK = '#1a1a18'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const BORDER = '#e7e2d8'
const PILL_BG = '#f6f3ec'
const GOOD = '#30a46c'
const BAD = '#e5484d'
const NEUTRAL = '#8a857b'

function fmt(n: number, decimals: number): string {
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()
}

function deltaColor(f: DayDelta['favorable']): string {
  return f === 'good' ? GOOD : f === 'bad' ? BAD : NEUTRAL
}

function Pill({ d }: { d: DayDelta }) {
  const arrow = d.delta > 0 ? '↑' : d.delta < 0 ? '↓' : ''
  const c = deltaColor(d.favorable)
  return (
    <div
      style={{
        flex: '0 0 auto',
        minWidth: 84,
        background: PILL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '10px 12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 500, marginBottom: 3 }}>{d.label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: INK, lineHeight: 1.1 }}>
        {fmt(d.value, d.decimals)}
        <span style={{ fontSize: 11, color: MUTED, fontFamily: 'inherit' }}>{d.unit}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: c, marginTop: 3 }}>
        {d.favorable === 'neutral' ? 'flat' : `${arrow}${fmt(Math.abs(d.delta), d.decimals)}`}
      </div>
    </div>
  )
}

export default function DayOverDayCard({ dod }: { dod: DayOverDay | null }) {
  if (!dod || dod.deltas.length === 0) return null

  return (
    <section
      style={{
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${ACCENT}`,
        borderRadius: 12,
        padding: '14px 16px 16px',
        marginBottom: 20,
        background: '#fffdf9',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>
        Since your last full day
      </div>
      <p style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.45, color: INK, margin: '0 0 14px' }}>
        {dod.lead}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {dod.deltas.map((d) => (
          <Pill key={d.key} d={d} />
        ))}
      </div>
    </section>
  )
}
