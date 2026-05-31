import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'True Mirror',
  description: 'Your health data, reflected honestly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
