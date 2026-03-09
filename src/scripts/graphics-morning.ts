/**
 * Morning script — run by GitHub Actions at 7:30 AM PT on weekdays.
 *
 * 1. Sends yesterday's daily summary email (compares AM vs PM snapshots)
 * 2. Takes today's morning snapshot of the graphics queue
 */

import { fetchGraphicsQueue } from '../lib/syncore/graphics-queue'
import { saveSnapshot, loadSnapshot, prevBusinessDayPT, todayPT } from '../lib/graphics-email/snapshot'
import { diffSnapshots } from '../lib/graphics-email/diff'
import { buildEmailHtml, buildEmailSubject } from '../lib/graphics-email/template'
import { sendGraphicsEmail } from '../lib/graphics-email/mailer'

async function run() {
  console.log(`[graphics-morning] Starting at ${new Date().toISOString()}`)

  // ── Step 1: Send yesterday's summary email ──────────────────────────────────
  const prevDay = prevBusinessDayPT()
  console.log(`[graphics-morning] Loading snapshots for ${prevDay}...`)

  const morningSnap = await loadSnapshot(prevDay, 'morning')
  const eveningSnap = await loadSnapshot(prevDay, 'evening')

  if (!morningSnap || !eveningSnap) {
    console.warn(
      `[graphics-morning] ⚠ Incomplete snapshots for ${prevDay} ` +
      `(morning=${!!morningSnap}, evening=${!!eveningSnap}) — skipping email`
    )
  } else {
    const diff = diffSnapshots(morningSnap.jobs, eveningSnap.jobs)

    const reportDate = new Date(prevDay + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const html = buildEmailHtml(diff, reportDate)
    const subject = buildEmailSubject(reportDate)

    console.log(`[graphics-morning] Sending email for ${prevDay}...`)
    await sendGraphicsEmail({ subject, html })
    console.log(
      `[graphics-morning] ✓ Email sent — ` +
      `${diff.summary.eveningTotal} jobs total, ` +
      `${diff.summary.completed} completed, ` +
      `${diff.summary.newJobs} new, ` +
      `${diff.summary.statusChanges} status changes`
    )
  }

  // ── Step 2: Take today's morning snapshot ───────────────────────────────────
  const today = todayPT()
  console.log(`[graphics-morning] Fetching current graphics queue for ${today}...`)

  const todayJobs = await fetchGraphicsQueue()
  await saveSnapshot('morning', todayJobs)
  console.log(`[graphics-morning] ✓ Morning snapshot saved — ${todayJobs.length} jobs`)

  console.log('[graphics-morning] Done.')
}

run().catch(err => {
  console.error('[graphics-morning] FATAL:', err)
  process.exit(1)
})
