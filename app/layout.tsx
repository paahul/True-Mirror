import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://truemirror.paahulhq.com'),
  title: 'True Mirror — Your health data, reflected honestly',
  description:
    'An iOS Shortcut reads your last 30 days of Apple Health data and Claude gives you a direct, no-sugarcoating analysis in ~10 seconds. No App Store, no export, no login.',
  openGraph: {
    title: 'True Mirror — Your health data, reflected honestly',
    description:
      'Apple Health × Claude. A direct, no-sugarcoating read on your last 30 days — what’s working, what needs attention, three things to do this week.',
    url: 'https://truemirror.paahulhq.com',
    siteName: 'True Mirror',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'True Mirror — Your health data, reflected honestly',
    description:
      'Apple Health × Claude. A direct read on your last 30 days, in ~10 seconds. No App Store, no export, no login.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body { background: #f7f4ef; color: #1a1a18; -webkit-font-smoothing: antialiased; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
