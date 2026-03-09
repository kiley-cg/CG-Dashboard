/**
 * Evening cron job — runs at 5:30 PM PT (01:30 UTC next day) on weekdays.
 *
 * Captures the end-of-day state of the graphics queue and stores it in Firestore.
 * The morning cron will compare this against the morning snapshot to build the email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchGraphicsQueue } from '@/lib/syncore/graphics-queue'
import { saveSnapshot, todayPT } from '@/lib/graphics-email/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const jobs = await fetchGraphicsQueue()
    await saveSnapshot('evening', jobs)

    return NextResponse.json({
      ok: true,
      date: todayPT(),
      jobCount: jobs.length,
      message: `Evening snapshot saved — ${jobs.length} jobs in queue`
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[graphics-evening cron] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
