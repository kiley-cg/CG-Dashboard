/**
 * Syncore Graphics Queue Fetcher
 *
 * Fetches all jobs currently in the graphics/production queue from Syncore CRM.
 * Uses username/password login to obtain a Bearer token, then queries the jobs API.
 *
 * CONFIGURATION (GitHub Secrets / env vars):
 * - SYNCORE_EMAIL:            Login email (e.g. __automation@colorgraphicswa.com)
 * - SYNCORE_PASSWORD:         Login password
 * - SYNCORE_GRAPHICS_DEPT_ID: Optional. Department ID to filter to graphics only.
 * - SYNCORE_JOB_STATUS:       Optional. Job status filter (default: "open").
 *                             Check Syncore for valid values if "open" doesn't work.
 */

const BASE = 'https://api.syncore.app/v2'

let cachedToken: string | null = null

async function login(): Promise<string> {
  if (cachedToken) return cachedToken

  const email = process.env.SYNCORE_EMAIL
  const password = process.env.SYNCORE_PASSWORD
  if (!email || !password) {
    throw new Error('SYNCORE_EMAIL and SYNCORE_PASSWORD must be set')
  }

  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Syncore login failed: HTTP ${res.status} — ${body}`)
  }

  const data = await res.json() as Record<string, unknown>
  const token =
    (data.token as string) ||
    (data.access_token as string) ||
    (data.accessToken as string) ||
    ((data.data as Record<string, unknown>)?.token as string) ||
    null

  if (!token) {
    throw new Error(`Syncore login response missing token. Keys: ${Object.keys(data).join(', ')}`)
  }

  cachedToken = token
  return token
}

function bearerHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
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

function mapJob(raw: Record<string, unknown>): GraphicsJob {
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

/** Rolling date window: last 180 days to today (PT) */
function dateRange() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 180 * 86_400_000).toISOString().slice(0, 10)
  return { date_from: from, date_to: to }
}

export async function fetchGraphicsQueue(): Promise<GraphicsJob[]> {
  const token = await login()
  const deptId = process.env.SYNCORE_GRAPHICS_DEPT_ID
  const status = process.env.SYNCORE_JOB_STATUS || 'open'
  const { date_from, date_to } = dateRange()

  const params = new URLSearchParams({ status, date_from, date_to })
  if (deptId) params.set('department_id', deptId)

  const url = `${BASE}/orders/jobs?${params.toString()}`
  const res = await fetch(url, { headers: bearerHeaders(token) })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Syncore graphics queue fetch failed: HTTP ${res.status} — ${body}`)
  }

  const data: unknown = await res.json()

  let rawJobs: Record<string, unknown>[]
  if (Array.isArray(data)) {
    rawJobs = data as Record<string, unknown>[]
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    rawJobs = (Array.isArray(obj.data) ? obj.data : Array.isArray(obj.jobs) ? obj.jobs : []) as Record<string, unknown>[]
  } else {
    rawJobs = []
  }

  return rawJobs.map(mapJob)
}

/** Returns the raw API response for debugging. */
export async function fetchGraphicsQueueRaw(): Promise<unknown> {
  const token = await login()
  const deptId = process.env.SYNCORE_GRAPHICS_DEPT_ID
  const status = process.env.SYNCORE_JOB_STATUS || 'open'
  const { date_from, date_to } = dateRange()

  const params = new URLSearchParams({ status, date_from, date_to })
  if (deptId) params.set('department_id', deptId)

  const url = `${BASE}/orders/jobs?${params.toString()}`
  const res = await fetch(url, { headers: bearerHeaders(token) })
  const body = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { parsed = body }
  return { status: res.status, url, body: parsed }
}
