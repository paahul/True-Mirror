import type { ReactNode } from 'react'
import type { MetricSnapshot, MetricChip } from '@/lib/types'

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const INK = '#1a1a18'
const BODY = '#3a3a36'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const BORDER = '#e7e2d8'
const PILL_BG = '#f6f3ec'
const C_GOOD = '#1f8a5b'
const C_WARN = '#b9791c'
const C_BAD = '#e5484d'
const WARN_BG = '#fcf5e8'
const WARN_BORDER = '#ecdcc0'
const GOOD_BG = '#eef6f0'
const GOOD_BORDER = '#cfe6d6'

export type Kind = 'good' | 'warn' | 'actions' | 'list'

// The narrative always has the same 3-part skeleton (enforced by the system
// prompt), so we can style it without parsing the per-person prose: detect the
// fixed headers, colour each section, and turn "Three things to do this week"
// into numbered action cards. Anything unrecognised falls back to plain text.
const SECTION_KINDS: { match: RegExp; kind: Kind }[] = [
  { match: /working/i, kind: 'good' },
  { match: /attention/i, kind: 'warn' },
  { match: /(do this week|three things|actions)/i, kind: 'actions' },
]

const KIND_COLOR: Record<Kind, string> = { good: C_GOOD, warn: C_WARN, actions: ACCENT, list: ACCENT }

export interface Section { title: string; kind: Kind; body: string[] }

// Tint for a section when shown as its own card (e.g. in the swipe deck).
export function sectionTint(kind: Kind): { bg: string; accent: string } {
  if (kind === 'good') return { bg: GOOD_BG, accent: C_GOOD }
  if (kind === 'warn') return { bg: WARN_BG, accent: C_WARN }
  return { bg: '#fffdf9', accent: ACCENT }
}

export function parseAnalysis(text: string): { preamble: string[]; sections: Section[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const sections: Section[] = []
  const preamble: string[] = []
  let cur: Section | null = null
  for (const line of lines) {
    const hm = line.match(/^\*\*(.+?)\*\*\s*$/) // a whole-line bold header
    if (hm) {
      const title = hm[1].trim()
      const kind = SECTION_KINDS.find((s) => s.match.test(title))?.kind ?? 'list'
      cur = { title, kind, body: [] }
      sections.push(cur)
    } else if (cur) {
      cur.body.push(line)
    } else {
      preamble.push(line)
    }
  }
  return { preamble, sections }
}

// Strip any leading list marker the model emitted ("1.", "1)", "-", "•", "*").
function stripMarker(line: string): string {
  return line.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, '').trim()
}

// Pull a leading [[metric]] tag, if present (old reports have none → text unchanged).
function extractTag(line: string): { tag: string | null; text: string } {
  const m = line.match(/^\[\[(\w+)\]\]\s*/)
  return m ? { tag: m[1], text: line.slice(m[0].length) } : { tag: null, text: line }
}

function ChipView({ chip }: { chip: MetricChip }) {
  const dc = chip.favorable === 'good' ? C_GOOD : chip.favorable === 'bad' ? C_BAD : MUTED
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 16, marginTop: 4, fontSize: 11.5, color: '#5c574e', background: '#fffdf9', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '2px 9px' }}
    >
      <strong style={{ fontWeight: 600, color: INK }}>{chip.label}</strong>
      <span>{chip.value}</span>
      {chip.delta && <span style={{ color: dc, fontWeight: 700 }}>{chip.delta}</span>}
    </span>
  )
}

// Inline **bold** within a line.
function inline(line: string, keyBase: string): ReactNode[] {
  return line.split(/\*\*(.*?)\*\*/).map((part, j) =>
    j % 2 === 1 ? <strong key={`${keyBase}-${j}`}>{part}</strong> : part,
  )
}

function Icon({ kind, color }: { kind: Kind; color: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'good')
    return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>)
  if (kind === 'warn')
    return (<svg {...common}><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>)
  if (kind === 'actions')
    return (<svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></svg>)
  return (<svg {...common}><circle cx="12" cy="12" r="3.5" fill={color} stroke="none" /></svg>)
}

const SIZES = {
  sm: { header: 14, body: 13.5, action: 13.5 },
  md: { header: 16, body: 14.5, action: 14.5 },
  lg: { header: 19, body: 15.5, action: 15 },
} as const

export function VerdictLine({ text, size = 'md' }: { text: string | null; size?: keyof typeof SIZES }) {
  if (!text) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 5 }}>
        Today&rsquo;s read
      </div>
      <p style={{ fontFamily: SERIF, fontSize: size === 'lg' ? 23 : 20, lineHeight: 1.3, fontWeight: 600, color: INK, margin: 0 }}>
        {text}
      </p>
    </div>
  )
}

// Renders ONE section. `framed` adds the tinted callout card (linear view);
// the swipe deck passes framed={false} since the deck card is the container.
export function AnalysisSection({
  section: sec,
  metrics,
  size = 'md',
  framed = true,
}: {
  section: Section
  metrics?: MetricSnapshot
  size?: keyof typeof SIZES
  framed?: boolean
}) {
  const s = SIZES[size]
  const color = KIND_COLOR[sec.kind]
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Icon kind={sec.kind} color={color} />
      <h3 style={{ fontFamily: SERIF, fontSize: s.header, fontWeight: 600, color, margin: 0 }}>{sec.title}</h3>
    </div>
  )

  const content =
    sec.kind === 'actions' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sec.body.map((line, j) => (
          <div
            key={`act-${j}`}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: PILL_BG, border: `1px solid ${BORDER}`, borderRadius: 11, padding: '11px 13px' }}
          >
            <span
              style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
            >
              {j + 1}
            </span>
            <span style={{ fontSize: s.action, lineHeight: 1.45, color: INK }}>{inline(stripMarker(line), `act-${j}`)}</span>
          </div>
        ))}
      </div>
    ) : (
      sec.body.map((line, j) => {
        const { tag, text: body } = extractTag(stripMarker(line))
        const chip = tag && metrics ? metrics[tag] : undefined
        return (
          <div key={`p-${j}`} style={{ margin: '6px 0' }}>
            <p style={{ display: 'flex', gap: 8, margin: 0, lineHeight: 1.55, fontSize: s.body, color: BODY }}>
              <span aria-hidden style={{ color, flex: '0 0 auto' }}>·</span>
              <span>{inline(body, `p-${j}`)}</span>
            </p>
            {chip && <ChipView chip={chip} />}
          </div>
        )
      })
    )

  // Tinted callout for working/attention in the linear (framed) view.
  if (framed && (sec.kind === 'good' || sec.kind === 'warn')) {
    const t = sectionTint(sec.kind)
    return (
      <div style={{ background: t.bg, border: `1px solid ${sec.kind === 'good' ? GOOD_BORDER : WARN_BORDER}`, borderLeft: `3px solid ${t.accent}`, borderRadius: 12, padding: '13px 15px 14px' }}>
        {header}
        {content}
      </div>
    )
  }

  return (
    <div>
      {header}
      {content}
    </div>
  )
}

export default function Analysis({
  text,
  metrics,
  size = 'md',
}: {
  text: string
  metrics?: MetricSnapshot
  size?: keyof typeof SIZES
}) {
  const { preamble, sections } = parseAnalysis(text)
  const s = SIZES[size]

  return (
    <div>
      {preamble.map((line, i) => (
        <p key={`pre-${i}`} style={{ margin: '6px 0', lineHeight: 1.6, fontSize: s.body, color: BODY }}>
          {inline(line, `pre-${i}`)}
        </p>
      ))}
      {sections.map((sec, i) => (
        <div key={`sec-${i}`} style={{ marginTop: i === 0 ? 4 : 18 }}>
          <AnalysisSection section={sec} metrics={metrics} size={size} />
        </div>
      ))}
    </div>
  )
}
