import type { DayOverDay, MetricSnapshot } from '@/lib/types'
import Analysis, { VerdictLine } from '@/app/components/Analysis'
import DayOverDayCard from '@/app/components/DayOverDayCard'

const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const INK = '#1a1a18'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const CARD = '#fffdf9'
const BORDER = '#e7e2d8'

// Sample report, rendered with the real product components so the homepage
// preview always matches what users actually get.
const SAMPLE_VERDICT = 'Moderately recovered but under-slept — keep today easy.'

const SAMPLE_DOD: DayOverDay = {
  latestDate: '2026-06-03',
  priorDate: '2026-06-02',
  lead: 'HRV is down 14 ms since your last full day — worth taking it easy today.',
  deltas: [
    { key: 'hrv', label: 'HRV', value: 44, prior: 58, delta: -14, unit: ' ms', decimals: 0, favorable: 'bad' },
    { key: 'resting_hr', label: 'Resting HR', value: 68, prior: 64, delta: 4, unit: ' bpm', decimals: 0, favorable: 'bad' },
    { key: 'sleep', label: 'Sleep', value: 6.1, prior: 7.4, delta: -1.3, unit: 'h', decimals: 1, favorable: 'bad' },
    { key: 'steps', label: 'Steps', value: 8420, prior: 7180, delta: 1240, unit: '', decimals: 0, favorable: 'good' },
  ],
}

const SAMPLE_METRICS: MetricSnapshot = {
  vo2: { label: 'VO₂ max', value: '41 ml/kg/min' },
  steps: { label: 'Steps', value: '8,420/day' },
  hrv: { label: 'HRV', value: '44 ms', delta: '↓14', favorable: 'bad' },
}

const SAMPLE_ANALYSIS = `**What's working**
[[vo2]] Your aerobic base is holding — VO₂ max of 41 hasn't slipped despite a lighter month.
[[steps]] Daily movement is solid — 8.4k steps a day without forcing it.

**What needs attention**
[[hrv]] HRV dropped 31% to 44 ms and resting HR is up to 68 — you're recovering worse while training less. That's stress, not fatigue.

**Three things to do this week**
1. Fix the 90-minute gap between lights-out and actually asleep.
2. Get HRV back above 50 — track it daily.
3. Three easy zone-2 walks before any hard session.`

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 13,
        color: MUTED,
        border: `1px solid ${BORDER}`,
        borderRadius: 999,
        padding: '5px 12px',
        background: CARD,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function Section({
  kicker,
  title,
  children,
}: {
  kicker?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 64 }}>
      {kicker && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: ACCENT,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {kicker}
        </div>
      )}
      {title && (
        <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, margin: '0 0 18px', lineHeight: 1.2 }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

const STEPS: [string, string][] = [
  ['Tap the Shortcut', 'You install it by tapping a link someone sends you. No App Store, no Xcode.'],
  ['Allow Health access', 'iOS asks once which data it can read. It only reads — it never changes anything.'],
  ['Claude reads 30 days', 'Your recent steps, sleep, heart rate, HRV and workouts get analysed against published methods.'],
  ['Get your report (~10s)', 'A direct read you can act on. Saved (if you want) so you can watch trends over time.'],
]

const SIGNALS: [string, string][] = [
  ['Recovery', 'HRV vs your baseline + resting HR + sleep — are you ready to push, or should you back off? (Altini / HRV4Training method)'],
  ['Sleep', 'Duration plus deep/REM/efficiency, weighted like Oura — not just hours in bed.'],
  ['Strain', 'Training load from your workouts’ heart rate (Banister TRIMP) — or activity when HR isn’t available.'],
  ['Stress', 'HRV suppression that your training load doesn’t explain — i.e. life stress, not just fatigue.'],
]

export default function Home() {
  return (
    <main
      style={{
        fontFamily: SANS,
        maxWidth: 720,
        margin: '0 auto',
        padding: '0 24px 96px',
        color: INK,
        lineHeight: 1.65,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '28px 0',
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600 }}>True&nbsp;Mirror</span>
        <span style={{ fontSize: 13, color: MUTED }}>Apple Health × Claude</span>
      </header>

      {/* Hero */}
      <section style={{ marginTop: 40 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 500, lineHeight: 1.08, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
          Your health data,
          <br />
          <em style={{ color: ACCENT, fontStyle: 'italic' }}>reflected honestly.</em>
        </h1>
        <p style={{ fontSize: 19, color: '#3a3a36', margin: '0 0 24px', maxWidth: 580 }}>
          An iOS Shortcut reads your last 30 days of Apple Health data and Claude gives you a
          direct, no-sugarcoating analysis — what’s working, what needs attention, what changed
          since yesterday, and three things to do this week. In about ten seconds.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip>No App Store</Chip>
          <Chip>No 2GB export</Chip>
          <Chip>No login</Chip>
          <Chip>~10 seconds</Chip>
        </div>
      </section>

      {/* How it works */}
      <Section kicker="How it works" title="Four taps, then it’s yours">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
          {STEPS.map(([t, d], i) => (
            <li
              key={t}
              style={{
                display: 'flex',
                gap: 16,
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: 22,
                  color: ACCENT,
                  fontWeight: 600,
                  minWidth: 24,
                  lineHeight: 1.3,
                }}
              >
                {i + 1}
              </span>
              <span>
                <strong style={{ fontWeight: 600 }}>{t}.</strong>{' '}
                <span style={{ color: MUTED }}>{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* What you get */}
      <Section kicker="What you get" title="A read you can act on">
        <div
          style={{
            background: '#f7f4ee',
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: '20px 20px 22px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontWeight: 600 }}>Sample analysis</span>
            <span style={{ fontSize: 12, color: MUTED }}>3 June</span>
          </div>
          <VerdictLine text={SAMPLE_VERDICT} />
          <DayOverDayCard dod={SAMPLE_DOD} />
          <Analysis text={SAMPLE_ANALYSIS} metrics={SAMPLE_METRICS} />
        </div>
        <p style={{ color: MUTED, fontSize: 13.5, margin: '0 0 24px' }}>
          In the app this is a card deck — your scores and verdict up front, then you swipe through
          strengths, watch-outs, and each action one at a time.
        </p>
        <p style={{ color: MUTED, fontSize: 14, margin: '0 0 16px' }}>
          Behind the words, four signals — grounded in published methods, not made up:
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {SIGNALS.map(([t, d]) => (
            <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: 16,
                  color: ACCENT,
                  fontWeight: 600,
                  minWidth: 84,
                }}
              >
                {t}
              </span>
              <span style={{ color: MUTED, fontSize: 15 }}>{d}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Why different */}
      <Section kicker="Why it’s different" title="Using Shortcuts as the pipeline">
        <p style={{ color: '#3a3a36', margin: '0 0 12px' }}>
          Most ways to get AI on your Apple Health data have a catch. The native apps need the
          App Store and a separate download per person. The DIY route makes you run Apple’s “Export
          All Health Data” — 30–45 minutes that locks up your phone and spits out a 2GB file most
          people never touch twice.
        </p>
        <p style={{ color: '#3a3a36', margin: 0 }}>
          iOS Shortcuts already has HealthKit access built in. True Mirror uses it as a data
          pipeline: read your metrics, send a small summary to a private API, get Claude’s analysis
          back — no App Store, no Xcode, no 2GB export. The honest trade-off: first-run setup is a
          handful of one-time iOS permission taps (it only ever reads your data). That friction is
          exactly why this is a personal tool, not a polished product.
        </p>
      </Section>

      {/* Honesty pull quote */}
      <section style={{ marginTop: 64 }}>
        <blockquote
          style={{
            margin: 0,
            paddingLeft: 20,
            borderLeft: `3px solid ${ACCENT}`,
            fontFamily: SERIF,
            fontSize: 23,
            fontStyle: 'italic',
            lineHeight: 1.4,
            color: INK,
          }}
        >
          Most health apps cheer you on. True Mirror tells you your sleep’s been slipping for three
          weeks and your resting heart rate is climbing. A mirror shows what’s actually there — not
          what you want to see.
        </blockquote>
      </section>

      {/* Privacy */}
      <Section kicker="Privacy" title="Only summaries leave your phone">
        <p style={{ color: '#3a3a36', margin: 0 }}>
          The Shortcut sends computed summaries to get your analysis — never a raw dump of your
          health history. Saving your reports to track trends is opt-in, and you can turn it off any
          time. The scoring uses published, citable methods, so you can check the math.
        </p>
      </Section>

      {/* Get it */}
      <Section kicker="Getting started" title="How to get it">
        <p style={{ color: '#3a3a36', margin: '0 0 18px' }}>
          True Mirror is a <strong>personal tool</strong>, not an App Store app — by design.
          There's no one-tap install, but there are two ways in:
        </p>
        <div style={{ display: 'grid', gap: 14, marginBottom: 28 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Build your own</div>
            <div style={{ color: MUTED, fontSize: 15 }}>
              It&rsquo;s open source. Deploy the small backend and assemble one iOS Shortcut
              (~1 hour, once), then it&rsquo;s yours forever. Full step-by-step in the{' '}
              <a href="https://github.com/paahul/True-Mirror/blob/main/docs/build-your-own.md" style={{ color: ACCENT }}>
                build guide
              </a>.
            </div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ask me to set you up</div>
            <div style={{ color: MUTED, fontSize: 15 }}>
              If you&rsquo;d rather not build it, I hand-provision a copy for friends. Heads-up:
              first-run involves a few iOS Health permission taps (it only ever reads your data).
            </div>
          </div>
        </div>
        <a
          href="mailto:sikandpaahul@gmail.com?subject=True%20Mirror"
          style={{
            display: 'inline-block',
            background: ACCENT,
            color: '#fff',
            padding: '13px 26px',
            borderRadius: 10,
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Reach out →
        </a>
      </Section>

      {/* Footer */}
      <footer style={{ marginTop: 80, paddingTop: 24, borderTop: `1px solid ${BORDER}`, color: MUTED, fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>
          Built by{' '}
          <a href="https://paahulhq.com" style={{ color: MUTED, textDecoration: 'underline' }}>
            Paahul
          </a>{' '}
          · reads Apple Health, analysed by Claude.
        </span>
        <a href="https://github.com/paahul/True-Mirror" style={{ color: MUTED }}>
          Source on GitHub →
        </a>
      </footer>
    </main>
  )
}
