import type { ReactNode } from 'react'

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const INK = '#1a1a18'
const BODY = '#3a3a36'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const BORDER = '#e7e2d8'
const PILL_BG = '#f6f3ec'
const C_GOOD = '#1f8a5b'
const C_WARN = '#b9791c'

type Kind = 'good' | 'warn' | 'actions' | 'list'

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

interface Section { title: string; kind: Kind; body: string[] }

function parse(text: string): { preamble: string[]; sections: Section[] } {
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

export default function Analysis({ text, size = 'md' }: { text: string; size?: keyof typeof SIZES }) {
  const { preamble, sections } = parse(text)
  const s = SIZES[size]

  return (
    <div>
      {preamble.map((line, i) => (
        <p key={`pre-${i}`} style={{ margin: '6px 0', lineHeight: 1.6, fontSize: s.body, color: BODY }}>
          {inline(line, `pre-${i}`)}
        </p>
      ))}

      {sections.map((sec, i) => {
        const color = KIND_COLOR[sec.kind]
        return (
          <section key={`sec-${i}`} style={{ marginTop: i === 0 ? 4 : 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon kind={sec.kind} color={color} />
              <h3 style={{ fontFamily: SERIF, fontSize: s.header, fontWeight: 600, color, margin: 0 }}>{sec.title}</h3>
            </div>

            {sec.kind === 'actions' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sec.body.map((line, j) => (
                  <div
                    key={`act-${i}-${j}`}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: PILL_BG, border: `1px solid ${BORDER}`, borderRadius: 11, padding: '11px 13px' }}
                  >
                    <span
                      style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
                    >
                      {j + 1}
                    </span>
                    <span style={{ fontSize: s.action, lineHeight: 1.45, color: INK }}>{inline(stripMarker(line), `act-${i}-${j}`)}</span>
                  </div>
                ))}
              </div>
            ) : (
              sec.body.map((line, j) => (
                <p key={`p-${i}-${j}`} style={{ display: 'flex', gap: 8, margin: '5px 0', lineHeight: 1.55, fontSize: s.body, color: BODY }}>
                  <span aria-hidden style={{ color, flex: '0 0 auto' }}>·</span>
                  <span>{inline(stripMarker(line), `p-${i}-${j}`)}</span>
                </p>
              ))
            )}
          </section>
        )
      })}
    </div>
  )
}
