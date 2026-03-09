/**
 * Evening script — run by GitHub Actions at 5:30 PM PT on weekdays.
 *
 * Captures the end-of-day state of the graphics queue in Firestore.
 * The morning script will compare this against the morning snapshot
 * to produce the next day's email.
 */

import { fetchGraphicsQueue } from '../lib/syncore/graphics-queue'
import { saveSnapshot, todayPT } from '../lib/graphics-email/snapshot'

async function run() {
  const today = todayPT()
  console.log(`[graphics-evening] Starting at ${new Date().toISOString()}`)
  console.log(`[graphics-evening] Fetching graphics queue for ${today}...`)

  const jobs = await fetchGraphicsQueue()
  await saveSnapshot('evening', jobs)

  console.log(`[graphics-evening] ✓ Evening snapshot saved — ${jobs.length} jobs in queue`)
  console.log('[graphics-evening] Done.')
}

run().catch(err => {
  console.error('[graphics-evening] FATAL:', err)
  process.exit(1)
})
