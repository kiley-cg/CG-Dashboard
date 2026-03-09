/**
 * Development-only endpoint for discovering the Syncore graphics queue API response shape.
 *
 * GET /api/cron/graphics-test
 *
 * Returns the raw Syncore API response (first 5 records) so you can:
 *  1. Confirm the correct endpoint is being hit
 *  2. See the real field names returned by Syncore
 *  3. Determine the correct SYNCORE_GRAPHICS_DEPT_ID value
 *
 * Also returns the mapped GraphicsJob array so you can verify the field mapping.
 *
 * Protected by CRON_SECRET. Remove or secure this route before production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchGraphicsQueue, fetchGraphicsQueueRaw } from '@/lib/syncore/graphics-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [raw, mapped] = await Promise.all([
      fetchGraphicsQueueRaw(),
      fetchGraphicsQueue()
    ])

    return NextResponse.json({
      ok: true,
      env: {
        SYNCORE_GRAPHICS_DEPT_ID: process.env.SYNCORE_GRAPHICS_DEPT_ID || '(not set — fetching all jobs)',
        EMAIL_USER: process.env.EMAIL_USER || '(not set)',
        EMAIL_TO: process.env.EMAIL_TO || '(not set)'
      },
      raw,
      mappedCount: mapped.length,
      mappedSample: mapped.slice(0, 3)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
