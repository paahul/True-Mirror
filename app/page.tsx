export default function Home() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 560,
        margin: '80px auto',
        padding: '0 24px',
        lineHeight: 1.6,
        color: '#111',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>True Mirror</h1>
      <p style={{ fontSize: 18, color: '#555', marginTop: 0 }}>
        Your health data, reflected honestly.
      </p>
      <p>
        Tap the Shortcut, get an honest analysis from Claude in ~10 seconds. What&rsquo;s
        working, what needs attention, and three things to do this week. No sugarcoating.
      </p>
      <p style={{ fontSize: 14, color: '#888' }}>
        Install link coming soon &mdash; reach out to get early access.
      </p>
    </main>
  )
}
