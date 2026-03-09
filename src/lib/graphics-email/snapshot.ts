/**
 * Firestore snapshot storage for the daily graphics queue email.
 *
 * Each business day we store two snapshots:
 *   graphicsSnapshots/{YYYY-MM-DD}-morning   — captured at 7:30 AM PT
 *   graphicsSnapshots/{YYYY-MM-DD}-evening   — captured at 5:30 PM PT
 *
 * The morning email (sent at 7:30 AM) compares the PREVIOUS business day's
 * morning and evening snapshots to build the summary.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import type { GraphicsJob } from '@/lib/syncore/graphics-queue'

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
      })
    })
  }
  return getFirestore()
}

export type SnapshotPeriod = 'morning' | 'evening'

export interface DaySnapshot {
  date: string              // "YYYY-MM-DD" in PT
  period: SnapshotPeriod
  capturedAt: string        // ISO timestamp
  jobs: GraphicsJob[]
}

/** Returns today's date string in Pacific Time (YYYY-MM-DD) */
export function todayPT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** Returns the previous business day's date string in PT */
export function prevBusinessDayPT(): string {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const day = today.getDay() // 0=Sun,1=Mon,...,6=Sat
  const offset = day === 1 ? 3 : day === 0 ? 2 : 1  // Monday → Friday (3), Sunday → Friday (2), else previous day
  today.setDate(today.getDate() - offset)
  return today.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** Saves a snapshot to Firestore */
export async function saveSnapshot(period: SnapshotPeriod, jobs: GraphicsJob[]): Promise<void> {
  const db = getDb()
  const date = todayPT()
  const docId = `${date}-${period}`

  // Strip raw field to avoid storing large blobs
  const cleanJobs = jobs.map(({ raw: _raw, ...rest }) => rest)

  await db.collection('graphicsSnapshots').doc(docId).set({
    date,
    period,
    capturedAt: new Date().toISOString(),
    jobs: cleanJobs
  })
}

/** Loads a snapshot from Firestore. Returns null if not found. */
export async function loadSnapshot(date: string, period: SnapshotPeriod): Promise<DaySnapshot | null> {
  const db = getDb()
  const doc = await db.collection('graphicsSnapshots').doc(`${date}-${period}`).get()
  if (!doc.exists) return null
  return doc.data() as DaySnapshot
}
