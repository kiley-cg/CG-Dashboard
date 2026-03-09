/**
 * Compares the morning and evening snapshots of the graphics queue to produce
 * the daily summary used in the email report.
 */

import type { GraphicsJob } from '@/lib/syncore/graphics-queue'

export interface StatusChange {
  job: GraphicsJob             // Evening version of the job
  previousStatus: string
  newStatus: string
}

export interface QueueDiff {
  summary: {
    morningTotal: number
    eveningTotal: number
    completed: number
    newJobs: number
    statusChanges: number
    unchanged: number
  }
  /** Jobs that were in the morning queue but are gone by evening (completed/removed) */
  completed: GraphicsJob[]
  /** Jobs whose status changed between morning and evening */
  statusChanged: StatusChange[]
  /** Jobs added during the day (present in evening, not in morning) */
  newJobs: GraphicsJob[]
  /** Jobs that exist in both snapshots with no status change */
  unchanged: GraphicsJob[]
}

export function diffSnapshots(morningJobs: GraphicsJob[], eveningJobs: GraphicsJob[]): QueueDiff {
  const morningMap = new Map(morningJobs.map(j => [j.id, j]))
  const eveningMap = new Map(eveningJobs.map(j => [j.id, j]))

  const completed: GraphicsJob[] = []
  const statusChanged: StatusChange[] = []
  const unchanged: GraphicsJob[] = []

  for (const [id, morningJob] of morningMap) {
    const eveningJob = eveningMap.get(id)
    if (!eveningJob) {
      // Job gone from queue — completed or removed
      completed.push(morningJob)
    } else if (eveningJob.status !== morningJob.status) {
      statusChanged.push({
        job: eveningJob,
        previousStatus: morningJob.status,
        newStatus: eveningJob.status
      })
    } else {
      unchanged.push(eveningJob)
    }
  }

  const newJobs = eveningJobs.filter(j => !morningMap.has(j.id))

  return {
    summary: {
      morningTotal: morningJobs.length,
      eveningTotal: eveningJobs.length,
      completed: completed.length,
      newJobs: newJobs.length,
      statusChanges: statusChanged.length,
      unchanged: unchanged.length
    },
    completed,
    statusChanged,
    newJobs,
    unchanged
  }
}
