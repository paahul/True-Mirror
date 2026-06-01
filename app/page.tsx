const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const INK = '#1a1a18'
const MUTED = '#6f6b62'
const ACCENT = '#1f6f63'
const CARD = '#fffdf9'
const BORDER = '#e7e2d8'

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
          direct, no-sugarcoating analysis — what’s working, what needs attention, and three
          things to do this week. In about ten seconds.
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
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: '22px 24px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Sample analysis</div>
          <h3 style={{ fontFamily: SERIF, fontSize: 17, margin: '0 0 4px' }}>What’s working</h3>
          <p style={{ margin: '0 0 14px', color: '#3a3a36', fontSize: 15 }}>
            Your aerobic base is holding — VO₂ max of 41 hasn’t slipped despite the lighter month.
          </p>
          <h3 style={{ fontFamily: SERIF, fontSize: 17, margin: '0 0 4px' }}>What needs attention</h3>
          <p style={{ margin: '0 0 14px', color: '#3a3a36', fontSize: 15 }}>
            HRV dropped 31% to 44ms and resting HR is up to 68. You’re recovering worse while
            training less — that’s stress, not fatigue.
          </p>
          <h3 style={{ fontFamily: SERIF, fontSize: 17, margin: '0 0 4px' }}>Three things to do this week</h3>
          <p style={{ margin: 0, color: '#3a3a36', fontSize: 15 }}>
            Fix the 90-minute gap between lights-out and asleep. Track HRV daily back above 50.
            Three easy zone-2 walks before any hard session.
          </p>
        </div>
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
      <Section kicker="Why it’s different" title="The shortcut nobody else took">
        <p style={{ color: '#3a3a36', margin: '0 0 12px' }}>
          Every other way to get AI on your Apple Health data has a catch. The native apps need the
          App Store and a separate download per person. The DIY route makes you run Apple’s “Export
          All Health Data” — 30–45 minutes that locks up your phone and spits out a 2GB file most
          people never touch twice.
        </p>
        <p style={{ color: '#3a3a36', margin: 0 }}>
          iOS Shortcuts already has HealthKit access built in. True Mirror uses it as a data
          pipeline: read your metrics, send a small summary to a private API, get Claude’s analysis
          back. You install by tapping a link, and your phone stays usable the whole time.
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
          True Mirror is in a small private beta with friends and family. If someone sent you the
          Shortcut link, setup takes about two minutes:
        </p>
        <ol style={{ color: MUTED, fontSize: 15, paddingLeft: 20, margin: '0 0 28px', display: 'grid', gap: 6 }}>
          <li>Tap the link → <strong style={{ color: INK }}>Add Shortcut</strong>.</li>
          <li>Settings → Shortcuts → Advanced → turn on <strong style={{ color: INK }}>Allow Sharing Large Amounts of Data</strong>.</li>
          <li>Run it → <strong style={{ color: INK }}>Allow</strong> the Health prompts, then <strong style={{ color: INK }}>Always Allow</strong> sending your summary.</li>
          <li>Read your analysis. Tap the Shortcut anytime to run it again.</li>
        </ol>
        <a
          href="mailto:sikandpaahul@gmail.com?subject=True%20Mirror%20invite"
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
          Request an invite →
        </a>
      </Section>

      {/* Footer */}
      <footer style={{ marginTop: 80, paddingTop: 24, borderTop: `1px solid ${BORDER}`, color: MUTED, fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>Built by Paahul · reads Apple Health, analysed by Claude.</span>
        <a href="https://github.com/paahul/True-Mirror" style={{ color: MUTED }}>
          Source on GitHub →
        </a>
      </footer>
    </main>
  )
}
