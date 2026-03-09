/**
 * Morning cron job — runs at 7:30 AM PT (15:30 UTC) on weekdays.
 *
 * Does two things:
 *   1. Sends yesterday's daily summary email (compares yesterday's AM vs PM snapshots)
 *   2. Takes a fresh morning snapshot of today's graphics queue for tonight's comparison
 *
 * Protected by CRON_SECRET env var (set the same value in Vercel env and vercel.json
 * is automatically handled by Vercel's cron auth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchGraphicsQueue } from '@/lib/syncore/graphics-queue'
import { saveSnapshot, loadSnapshot, prevBusinessDayPT, todayPT } from '@/lib/graphics-email/snapshot'
import { diffSnapshots } from '@/lib/graphics-email/diff'
import { buildEmailHtml, buildEmailSubject } from '@/lib/graphics-email/template'
import { sendGraphicsEmail } from '@/lib/graphics-email/mailer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  try {
    // ── Step 1: Send yesterday's summary email ────────────────────────────────
    const prevDay = prevBusinessDayPT()
    const morningSnap = await loadSnapshot(prevDay, 'morning')
    const eveningSnap = await loadSnapshot(prevDay, 'evening')

    if (!morningSnap || !eveningSnap) {
      results.push(`⚠ No complete snapshots found for ${prevDay} — skipping email (morningSnap=${!!morningSnap}, eveningSnap=${!!eveningSnap})`)
    } else {
      const diff = diffSnapshots(morningSnap.jobs, eveningSnap.jobs)

      // Format the report date nicely: "Monday, February 17, 2026"
      const reportDate = new Date(prevDay + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const html = buildEmailHtml(diff, reportDate)
      const subject = buildEmailSubject(reportDate)

      await sendGraphicsEmail({ subject, html })
      results.push(`✓ Email sent for ${prevDay} — ${diff.summary.eveningTotal} jobs, ${diff.summary.completed} completed, ${diff.summary.newJobs} new`)
    }

    // ── Step 2: Take today's morning snapshot ────────────────────────────────
    const todayJobs = await fetchGraphicsQueue()
    await saveSnapshot('morning', todayJobs)
    results.push(`✓ Morning snapshot saved for ${todayPT()} — ${todayJobs.length} jobs`)

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[graphics-morning cron] Error:', message)
    return NextResponse.json({ ok: false, error: message, results }, { status: 500 })
  }
}
