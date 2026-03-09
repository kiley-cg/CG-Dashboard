/**
 * Syncore Graphics Queue Fetcher
 *
 * Fetches all jobs currently in the graphics/production queue from Syncore CRM.
 *
 * CONFIGURATION:
 * - SYNCORE_API_KEY: Required. Your Syncore API key.
 * - SYNCORE_GRAPHICS_DEPT_ID: Optional. The numeric department ID for the graphics
 *   department in Syncore (e.g., "3"). If not set, all active jobs are fetched.
 *
 * HOW TO FIND YOUR DEPARTMENT ID:
 * 1. Log into Syncore and navigate to Jobs > Graphics / Production board
 * 2. Note the URL — it likely has a department or filter ID in the query string
 * 3. Or call GET /orders/jobs without a filter, inspect the response `department` field,
 *    and set that ID as SYNCORE_GRAPHICS_DEPT_ID
 *
 * The /api/cron/graphics-test endpoint (GET) will dump the raw API response to help
 * you discover the correct field names and department ID.
 */

const BASE = 'https://api.syncore.app/v2'

function headers() {
  return {
    'x-api-key': process.env.SYNCORE_API_KEY!,
    'Content-Type': 'application/json'
  }
}

export interface GraphicsJob {
  /** Syncore internal job ID — used as the stable key for diff comparisons */
  id: string
  /** Human-readable job number shown on the tracker (e.g., "32026") */
  jobNumber: string
  /** Current production status: "In Progress", "Submitted", "On Hold", etc. */
  status: string
  /** Assigned designer name, or null if unassigned */
  designer: string | null
  /** Client / customer name */
  client: string
  /** Job description (product name) */
  description: string
  /** Number of days the job has been in the queue */
  daysInQueue: number
  /** Priority level: "CRITICAL", "Standard", or null */
  priority: string | null
  /** Raw Syncore record for debugging */
  raw?: unknown
}

/**
 * Maps a raw Syncore job API response to our GraphicsJob shape.
 * Field names are best-guesses based on the existing client.ts patterns.
 * Adjust the mapping after inspecting live API responses via /api/cron/graphics-test.
 */
function mapJob(raw: Record<string, unknown>): GraphicsJob {
  // Days in queue: try several possible field names
  const createdAt =
    (raw.created_at as string) ||
    (raw.createdAt as string) ||
    (raw.date_created as string) ||
    null

  let daysInQueue = 0
  if (typeof raw.days_in_queue === 'number') {
    daysInQueue = raw.days_in_queue
  } else if (typeof raw.daysInQueue === 'number') {
    daysInQueue = raw.daysInQueue
  } else if (createdAt) {
    const created = new Date(createdAt)
    daysInQueue = Math.floor((Date.now() - created.getTime()) / 86_400_000)
  }

  // Designer field
  const designerRaw =
    (raw.designer as string | Record<string, unknown> | null) ||
    (raw.assigned_to as string | Record<string, unknown> | null) ||
    null
  const designer =
    typeof designerRaw === 'string'
      ? designerRaw
      : typeof designerRaw === 'object' && designerRaw !== null
      ? ((designerRaw as Record<string, unknown>).name as string) || null
      : null

  // Client field
  const customerRaw =
    (raw.customer as Record<string, unknown> | string | null) ||
    (raw.client as string | null) ||
    null
  const client =
    typeof customerRaw === 'string'
      ? customerRaw
      : typeof customerRaw === 'object' && customerRaw !== null
      ? ((customerRaw as Record<string, unknown>).name as string) || 'Unknown'
      : 'Unknown'

  return {
    id: String(raw.id || raw.job_id || raw.jobId || ''),
    jobNumber: String(raw.number || raw.job_number || raw.jobNumber || raw.id || ''),
    status: String(raw.status || raw.production_status || raw.productionStatus || 'Unknown'),
    designer,
    client,
    description: String(raw.name || raw.description || raw.title || ''),
    daysInQueue,
    priority:
      (raw.priority as string) ||
      (raw.rush as boolean ? 'CRITICAL' : null) ||
      'Standard',
    raw
  }
}

/**
 * Fetches all jobs from the Syncore graphics/production queue.
 *
 * Uses SYNCORE_GRAPHICS_DEPT_ID env var to filter by department if set.
 * Otherwise fetches all active/open jobs.
 *
 * Returns an array of mapped GraphicsJob objects.
 */
export async function fetchGraphicsQueue(): Promise<GraphicsJob[]> {
  const deptId = process.env.SYNCORE_GRAPHICS_DEPT_ID

  // Build query params — adjust based on live API discovery
  const params = new URLSearchParams()
  if (deptId) {
    params.set('department_id', deptId)
  }
  // Common status filters to limit to active jobs; adjust as needed
  params.set('status', 'active')

  const url = `${BASE}/orders/jobs?${params.toString()}`
  const res = await fetch(url, { headers: headers() })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Syncore graphics queue fetch failed: HTTP ${res.status} — ${body}`)
  }

  const data: unknown = await res.json()

  // Normalize response shape (array, or { data: [...] }, or { jobs: [...] })
  let rawJobs: Record<string, unknown>[]
  if (Array.isArray(data)) {
    rawJobs = data as Record<string, unknown>[]
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    rawJobs = (Array.isArray(obj.data) ? obj.data : Array.isArray(obj.jobs) ? obj.jobs : []) as Record<
      string,
      unknown
    >[]
  } else {
    rawJobs = []
  }

  return rawJobs.map(mapJob)
}

/**
 * Returns the raw Syncore API response for debugging / endpoint discovery.
 * Used by /api/cron/graphics-test.
 */
export async function fetchGraphicsQueueRaw(): Promise<unknown> {
  const deptId = process.env.SYNCORE_GRAPHICS_DEPT_ID
  const params = new URLSearchParams()
  if (deptId) params.set('department_id', deptId)
  params.set('status', 'active')

  const url = `${BASE}/orders/jobs?${params.toString()}`
  const res = await fetch(url, { headers: headers() })
  const body = await res.text()
  return { status: res.status, url, body: JSON.parse(body).slice ? JSON.parse(body).slice(0, 5) : JSON.parse(body) }
}
