import { NextRequest, NextResponse } from 'next/server'
import { getUsersWithReminders } from '@/lib/supabase'

// Vercel Cron: runs every hour (configured in vercel.json)
// Finds users whose local reminder time falls in the current UTC hour and emails them.
//
// To enable: add RESEND_API_KEY to env vars and wire up sendEmail() below.

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron, not the public internet
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const users = await getUsersWithReminders()

  const results = { charge: 0, wear: 0, errors: 0 }

  for (const user of users) {
    if (!user.email || !user.timezone) continue

    try {
      const localHour = getLocalHour(now, user.timezone)

      if (user.charge_reminder && user.charge_reminder_at) {
        const reminderHour = parseInt(user.charge_reminder_at.split(':')[0], 10)
        if (localHour === reminderHour) {
          await sendEmail({
            to: user.email,
            subject: 'Charge your Apple Watch tonight',
            text: `Hey ${user.name} — plug your Watch in tonight so tomorrow's health data is complete. Consistent wearing = better insights from True Mirror.`,
          })
          results.charge++
        }
      }

      if (user.wear_reminder && user.wear_reminder_at) {
        const reminderHour = parseInt(user.wear_reminder_at.split(':')[0], 10)
        if (localHour === reminderHour) {
          await sendEmail({
            to: user.email,
            subject: "Don't forget your Apple Watch today",
            text: `Good morning ${user.name} — don't forget to put on your Watch. Every day you wear it, True Mirror gets a clearer picture of your health.`,
          })
          results.wear++
        }
      }
    } catch {
      results.errors++
    }
  }

  return NextResponse.json(results)
}

function getLocalHour(utcDate: Date, timezone: string): number {
  const localTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(utcDate)
  return parseInt(localTimeStr, 10)
}

// TODO: replace with Resend (recommended) or any transactional email provider
// npm install resend  →  import { Resend } from 'resend'
async function sendEmail(_params: { to: string; subject: string; text: string }) {
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'True Mirror <noreply@truemirror.paahulhq.com>',
  //   to: params.to,
  //   subject: params.subject,
  //   text: params.text,
  // })
  throw new Error('Email provider not configured — add RESEND_API_KEY and uncomment sendEmail()')
}
