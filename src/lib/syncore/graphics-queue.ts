/**
 * Ateasi / Syncore Graphics Queue Fetcher
 *
 * Authenticates against https://www.ateasesystems.net using cookie-based
 * ASP.NET session auth, then fetches graphics queue job data.
 *
 * CONFIGURATION (GitHub Secrets):
 * - SYNCORE_EMAIL:            Login email (__automation@colorgraphicswa.com)
 * - SYNCORE_PASSWORD:         Login password
 * - SYNCORE_GRAPHICS_DEPT_ID: Optional department ID filter
 * - SYNCORE_JOB_STATUS:       Optional status filter
 */

const SITE = 'https://www.ateasesystems.net'

// ── Cookie jar (simple in-process store) ─────────────────────────────────────

let sessionCookies: Record<string, string> = {}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {}
  const result: Record<string, string> = {}
  // Set-Cookie can be multi-value; split on ", " only at cookie boundaries
  const parts = header.split(/,\s*(?=[A-Za-z0-9_-]+=)/)
  for (const part of parts) {
    const [nameVal] = part.split(';')
    const eq = nameVal.indexOf('=')
    if (eq === -1) continue
    const name = nameVal.slice(0, eq).trim()
    const value = nameVal.slice(eq + 1).trim()
    result[name] = value
  }
  return result
}

function cookieHeader(): string {
  return Object.entries(sessionCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function storeCookies(res: Response) {
  // node-fetch exposes all Set-Cookie via getAll; native fetch only gives first
  const raw = res.headers.get('set-cookie')
  Object.assign(sessionCookies, parseCookies(raw))
}

// ── CSRF token extraction ─────────────────────────────────────────────────────

function extractAntiForgery(html: string): string | null {
  const m =
    html.match(/name="__RequestVerificationToken"[^>]+value="([^"]+)"/) ||
    html.match(/value="([^"]+)"[^>]+name="__RequestVerificationToken"/)
  return m ? m[1] : null
}

// ── Login ─────────────────────────────────────────────────────────────────────

let loggedIn = false

async function login(): Promise<void> {
  if (loggedIn) return

  const email = process.env.SYNCORE_EMAIL
  const password = process.env.SYNCORE_PASSWORD
  if (!email || !password) throw new Error('SYNCORE_EMAIL and SYNCORE_PASSWORD must be set')

  // Step 1: GET login page → capture initial cookies + CSRF token
  console.log(`[syncore] GET ${SITE}/Account/Login`)
  const getRes = await fetch(`${SITE}/Account/Login`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; automation)' }
  })
  storeCookies(getRes)
  const html = await getRes.text()

  const csrfToken = extractAntiForgery(html)
  if (!csrfToken) {
    console.log('[syncore] WARNING: __RequestVerificationToken not found — attempting login without it')
  } else {
    console.log('[syncore] CSRF token extracted')
  }

  // Step 2: POST credentials
  const form = new URLSearchParams()
  form.set('Email', email)
  form.set('Password', password)
  if (csrfToken) form.set('__RequestVerificationToken', csrfToken)

  console.log(`[syncore] POST ${SITE}/Account/Login`)
  const postRes = await fetch(`${SITE}/Account/Login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'Referer': `${SITE}/Account/Login`,
    },
    body: form.toString(),
    redirect: 'manual',
  })

  storeCookies(postRes)
  console.log(`[syncore] Login response: HTTP ${postRes.status} | Location: ${postRes.headers.get('location') || '(none)'} | Cookies set: ${Object.keys(sessionCookies).join(', ')}`)

  if (postRes.status !== 200 && postRes.status !== 302 && postRes.status !== 301) {
    const body = await postRes.text()
    throw new Error(`Login failed: HTTP ${postRes.status}\n${body.slice(0, 500)}`)
  }

  loggedIn = true
  console.log('[syncore] Login successful')
}

// ── Authenticated GET helper ──────────────────────────────────────────────────

async function authedGet(path: string): Promise<Response> {
  return fetch(`${SITE}${path}`, {
    headers: {
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/html, */*',
    }
  })
}

async function authedPost(path: string, body: Record<string, unknown> | URLSearchParams): Promise<Response> {
  const isJson = !(body instanceof URLSearchParams)
  return fetch(`${SITE}${path}`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader(),
      'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, */*',
    },
    body: isJson ? JSON.stringify(body) : body.toString(),
  })
}

// ── Job data discovery ────────────────────────────────────────────────────────

/**
 * Fetch /Jobs HTML and print all inline <script> lines that mention
 * ajax/url/fetch/api/json so we can identify the DataTables data source.
 */
async function discoverAjaxEndpoints() {
  const res = await authedGet('/Jobs')
  const html = await res.text()

  // Extract every <script>...</script> block
  const scriptBlocks: string[] = []
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(html)) !== null) {
    scriptBlocks.push(m[1])
  }

  const interestingLines: string[] = []
  const keywords = /ajax|\"url\"|'url'|\bfetch\b|\/api\/|\.json|GetJobs|DataTable|datatable|sAjax/i
  for (const block of scriptBlocks) {
    for (const line of block.split('\n')) {
      if (keywords.test(line)) {
        interestingLines.push(line.trim())
      }
    }
  }

  console.log(`[syncore] /Jobs script scan — ${interestingLines.length} interesting lines:`)
  for (const l of interestingLines) {
    console.log(`  ${l.slice(0, 200)}`)
  }

  // Also try /api/jobs with a few action suffixes
  const apiPaths = [
    '/api/jobs/GetAll',
    '/api/jobs/List',
    '/api/jobs/Search',
    '/api/jobs/GetByDepartment',
    '/api/jobs?status=InProduction',
  ]
  for (const path of apiPaths) {
    try {
      const r = await authedGet(path)
      const text = await r.text()
      console.log(`[syncore] GET ${path} → ${r.status} | ${text.slice(0, 200).replace(/\s+/g, ' ')}`)
    } catch (err) {
      console.log(`[syncore] GET ${path} → ERROR: ${err}`)
    }
  }
}

// ── Export interfaces ─────────────────────────────────────────────────────────

export interface GraphicsJob {
  id: string
  jobNumber: string
  status: string
  designer: string | null
  client: string
  description: string
  daysInQueue: number
  priority: string | null
  raw?: unknown
}

function mapJob(raw: Record<string, unknown>): GraphicsJob {
  const createdAt =
    (raw.created_at as string) || (raw.createdAt as string) || (raw.date_created as string) || null

  let daysInQueue = 0
  if (typeof raw.days_in_queue === 'number') daysInQueue = raw.days_in_queue
  else if (typeof raw.daysInQueue === 'number') daysInQueue = raw.daysInQueue
  else if (createdAt) {
    daysInQueue = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  }

  const designerRaw =
    (raw.designer as string | Record<string, unknown> | null) ||
    (raw.assigned_to as string | Record<string, unknown> | null) || null
  const designer =
    typeof designerRaw === 'string' ? designerRaw
    : typeof designerRaw === 'object' && designerRaw !== null
    ? ((designerRaw as Record<string, unknown>).name as string) || null
    : null

  const customerRaw = (raw.customer as Record<string, unknown> | string | null) || (raw.client as string | null) || null
  const client =
    typeof customerRaw === 'string' ? customerRaw
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
    priority: (raw.priority as string) || (raw.rush as boolean ? 'CRITICAL' : null) || 'Standard',
    raw,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchGraphicsQueue(): Promise<GraphicsJob[]> {
  await login()

  console.log('[syncore] --- Scanning /Jobs page for AJAX endpoints ---')
  await discoverAjaxEndpoints()
  console.log('[syncore] --- Discovery complete ---')

  // TODO: once the correct endpoint is identified from the discovery output above,
  // replace this section with a direct call to that endpoint.
  return []
}
