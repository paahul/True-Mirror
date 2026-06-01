import { Suspense } from 'react'
import type { Metadata } from 'next'
import HistoryClient from './HistoryClient'

export const metadata: Metadata = {
  title: 'True Mirror — Your History',
  description: 'Your health analyses over time.',
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxWidth: 560,
            margin: '0 auto',
            padding: '40px 24px',
            color: '#888',
          }}
        >
          Loading…
        </main>
      }
    >
      <HistoryClient />
    </Suspense>
  )
}
