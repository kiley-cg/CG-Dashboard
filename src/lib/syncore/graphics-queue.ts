/**
 * Ateasi (@ease) Graphics Queue Fetcher
 *
 * Authenticates against https://us.ateasesystems.net, navigates to the
 * Jobs → Graphic Services page, submits the search form with sensible
 * defaults, and parses the resulting HTML table.
 *
 * CONFIGURATION (GitHub Secrets):
 * - SYNCORE_EMAIL:    Login username / email
 * - SYNCORE_PASSWORD: Login password
 */

const SITE = 'https://us.ateasesystems.net'

// ── Cookie jar ────────────────────────────────────────────────────────────────

let sessionCookies: Record<string, string> = {}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {}
  const result: Record<string, string> = {}
  const parts = header.split(/,\s*(?=[A-Za-z0-9_-]+=)/)
  for (const part of parts) {
    const [nameVal] = part.split(';')
    const eq = nameVal.indexOf('=')
    if (eq === -1) continue
    result[nameVal.slice(0, eq).trim()] = nameVal.slice(eq + 1).trim()
  }
  return result
}

function cookieHeader(): string {
  return Object.entries(sessionCookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function storeCookies(res: Response) {
  Object.assign(sessionCookies, parseCookies(res.headers.get('set-cookie')))
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function extractAntiForgery(html: string): string | null {
  const m =
    html.match(/name="__RequestVerificationToken"[^>]+value="([^"]+)"/) ||
    html.match(/value="([^"]+)"[^>]+name="__RequestVerificationToken"/)
  return m ? m[1] : null
}

/** Extract all <input>, <select> default values from a form. */
function extractFormDefaults(html: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // Inputs (text, hidden, radio checked, checkbox checked)
  const inputRe = /<input([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = inputRe.exec(html)) !== null) {
    const attrs = m[1]
    const name = (attrs.match(/name=["']([^"']+)["']/i) || [])[1]
    const value = (attrs.match(/value=["']([^"']*)["']/i) || [])[1] ?? ''
    const type = ((attrs.match(/type=["']([^"']+)["']/i) || [])[1] ?? 'text').toLowerCase()
    if (!name) continue
    if (type === 'submit') continue
    if (type === 'radio' && !/checked/i.test(attrs)) continue
    if (type === 'checkbox' && !/checked/i.test(attrs)) continue
    fields[name] = value
  }

  // Selects — use the <option selected> value, or first option
  const selectRe = /<select[^>]+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi
  while ((m = selectRe.exec(html)) !== null) {
    const name = m[1]
    const body = m[2]
    const selectedM = body.match(/<option[^>]+selected[^>]*value=["']([^"']*)["']/i) ||
                      body.match(/<option[^>]+value=["']([^"']*)["'][^>]*selected/i)
    if (selectedM) {
      fields[name] = selectedM[1]
    } else {
      const firstM = body.match(/<option[^>]+value=["']([^"']*)["']/i)
      if (firstM) fields[name] = firstM[1]
    }
  }

  return fields
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith('http')) return href
  if (href.startsWith('/')) {
    try { return `${new URL(base).origin}${href}` } catch { return `${SITE}${href}` }
  }
  return `${base.replace(/\/[^/]*$/, '/')}${href}`
}

// ── Login ─────────────────────────────────────────────────────────────────────

let loggedIn = false
let graphicServicesUrl: string | null = null

async function login(): Promise<void> {
  if (loggedIn) return

  const email = process.env.SYNCORE_EMAIL
  const password = process.env.SYNCORE_PASSWORD
  if (!email || !password) throw new Error('SYNCORE_EMAIL and SYNCORE_PASSWORD must be set')

  // GET home — will redirect to login if not authenticated
  console.log(`[ateasi] GET ${SITE}/index.asp`)
  const homeRes = await fetch(`${SITE}/index.asp`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; automation)' },
  })
  storeCookies(homeRes)
  const homeHtml = await homeRes.text()
  const homeUrl = homeRes.url
  console.log(`[ateasi] → HTTP ${homeRes.status} final URL: ${homeUrl}`)

  // Is this a login page already, or do we need a separate login URL?
  let loginHtml = homeHtml
  let loginUrl = homeUrl

  if (!homeHtml.match(/type=["']password["']/i)) {
    const altRes = await fetch(`${SITE}/Account/Login`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; automation)',
        'Cookie': cookieHeader(),
      },
    })
    storeCookies(altRes)
    loginHtml = await altRes.text()
    loginUrl = altRes.url
    console.log(`[ateasi] GET /Account/Login → HTTP ${altRes.status} final URL: ${loginUrl}`)
  }

  // Build form payload — preserve all hidden/default fields
  const fields = extractFormDefaults(loginHtml)
  const csrfToken = extractAntiForgery(loginHtml)
  if (csrfToken) fields['__RequestVerificationToken'] = csrfToken

  const usernameField = Object.keys(fields).find(k => /^(email|username|user|login)$/i.test(k)) ?? 'Email'
  const passwordField = Object.keys(fields).find(k => /^(password|pass|pwd)$/i.test(k)) ?? 'Password'
  fields[usernameField] = email
  fields[passwordField] = password

  // Form action
  const actionM = loginHtml.match(/<form[^>]+action=["']([^"']+)["']/i)
  const actionUrl = actionM ? resolveUrl(loginUrl, actionM[1]) : loginUrl

  console.log(`[ateasi] POST ${actionUrl}`)
  const postRes = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'Referer': loginUrl,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  })
  storeCookies(postRes)
  console.log(`[ateasi] Login → HTTP ${postRes.status} Location: ${postRes.headers.get('location') ?? '(none)'} Cookies: ${Object.keys(sessionCookies).join(', ')}`)

  if (postRes.status >= 400) {
    const body = await postRes.text()
    throw new Error(`Login failed: HTTP ${postRes.status}\n${body.slice(0, 500)}`)
  }

  loggedIn = true
  console.log('[ateasi] Login successful')
}

// ── Authenticated GET ─────────────────────────────────────────────────────────

async function authedGet(pathOrUrl: string): Promise<Response> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE}${pathOrUrl}`
  return fetch(url, {
    headers: {
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'Accept': 'text/html,application/xhtml+xml,*/*',
    },
  })
}

// ── Find Graphic Services URL ─────────────────────────────────────────────────

async function findGraphicServicesUrl(): Promise<string> {
  if (graphicServicesUrl) return graphicServicesUrl

  // Follow home page then scan nav links for "Graphic Services"
  const res = await authedGet('/index.asp')
  const html = await res.text()

  const linkRe = /href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').trim()
    if (/graphic[\s_-]?services?/i.test(text) || /graphic[\s_-]?services?/i.test(m[1])) {
      graphicServicesUrl = resolveUrl(res.url, m[1])
      console.log(`[ateasi] Found Graphic Services URL: ${graphicServicesUrl}`)
      return graphicServicesUrl
    }
  }

  // Fallback — try common ASP page names
  const fallbacks = [
    '/graphic_services.asp',
    '/graphicservices.asp',
    '/jobs_graphic.asp',
    '/graphic.asp',
  ]
  for (const path of fallbacks) {
    const r = await authedGet(path)
    if (r.status === 200) {
      const text = await r.text()
      if (/graphic/i.test(text)) {
        graphicServicesUrl = `${SITE}${path}`
        console.log(`[ateasi] Found Graphic Services URL (fallback): ${graphicServicesUrl}`)
        return graphicServicesUrl
      }
    }
  }

  throw new Error('Could not locate the Graphic Services page. Check navigation.')
}

// ── Submit search and return results HTML ─────────────────────────────────────

async function submitGraphicsSearch(): Promise<string> {
  const pageUrl = await findGraphicServicesUrl()

  // Load the search form page
  const pageRes = await authedGet(pageUrl)
  const pageHtml = await pageRes.text()
  console.log(`[ateasi] GET Graphic Services → HTTP ${pageRes.status}`)

  // Extract all form defaults
  const fields = extractFormDefaults(pageHtml)

  // Override key filters for daily queue (all non-completed in-house jobs)
  // Primary Status: Enabled (radio value is typically "1" or "true" or "E")
  // Tracking Status: All (excluding Completed) — keep default
  // Service Provider: In-House — keep default
  // Job Date From: wide range to capture everything
  // Artwork Due Date: today + 60 days is already default; keep it

  console.log('[ateasi] Search form fields:', JSON.stringify(fields))

  const formActionM = pageHtml.match(/<form[^>]+action=["']([^"']+)["']/i)
  const actionUrl = formActionM
    ? resolveUrl(pageUrl, formActionM[1])
    : pageUrl

  console.log(`[ateasi] POST search → ${actionUrl}`)
  const searchRes = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'Referer': pageUrl,
    },
    body: new URLSearchParams(fields).toString(),
  })
  storeCookies(searchRes)
  const resultsHtml = await searchRes.text()
  console.log(`[ateasi] Search response → HTTP ${searchRes.status} | ${resultsHtml.length} bytes`)

  return resultsHtml
}

// ── HTML table parser ─────────────────────────────────────────────────────────

function parseHtmlTable(html: string): Array<Record<string, string>> {
  // Extract table headers
  const theadM = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)
  const headers: string[] = []
  if (theadM) {
    const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi
    let m: RegExpExecArray | null
    while ((m = thRe.exec(theadM[1])) !== null) {
      headers.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
  }

  // Extract table rows from tbody
  const tbodyM = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyM) {
    console.log('[ateasi] No <tbody> found in results')
    return []
  }

  const rows: Array<Record<string, string>> = []
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trM: RegExpExecArray | null
  while ((trM = trRe.exec(tbodyM[1])) !== null) {
    const cells: string[] = []
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdM: RegExpExecArray | null
    while ((tdM = tdRe.exec(trM[1])) !== null) {
      cells.push(tdM[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim())
    }
    if (cells.length === 0) continue

    if (headers.length > 0) {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
      rows.push(row)
    } else {
      rows.push(Object.fromEntries(cells.map((c, i) => [String(i), c])))
    }
  }

  return rows
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

function mapRow(row: Record<string, string>): GraphicsJob {
  // Column names are whatever @ease uses — try multiple variants
  const get = (...keys: string[]) =>
    keys.map(k => row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? '').find(v => v !== '') ?? ''

  const jobNum = get('Job #', 'Job#', 'JobNumber', 'Job Number', '0')
  const client = get('Client', 'Customer', 'Account', '1') || 'Unknown'
  const description = get('Description', 'Job Name', 'Name', 'Title', '2')
  const status = get('Tracking Status', 'Status', 'Job Status', 'TrackingStatus', '3')
  const designer = get('Designer', 'Assigned To', 'AssignedTo', '4') || null
  const priority = get('Job Priority', 'Priority', '5') || 'Standard'
  const dateStr = get('Job Date', 'Created', 'Date', '6')

  let daysInQueue = 0
  if (dateStr) {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      daysInQueue = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    }
  }

  return {
    id: jobNum,
    jobNumber: jobNum,
    status,
    designer: designer || null,
    client,
    description,
    daysInQueue,
    priority,
    raw: row,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchGraphicsQueue(): Promise<GraphicsJob[]> {
  await login()

  const resultsHtml = await submitGraphicsSearch()

  // Debug: print column headers found
  const theadM = resultsHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)
  if (theadM) {
    const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi
    const cols: string[] = []
    let m: RegExpExecArray | null
    while ((m = thRe.exec(theadM[1])) !== null) {
      cols.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
    console.log('[ateasi] Table columns:', cols.join(' | '))
  } else {
    // No table found — dump page snippet for debugging
    console.log('[ateasi] No <thead> in results. Page snippet:')
    console.log(resultsHtml.slice(0, 1500).replace(/\s+/g, ' '))
  }

  const rows = parseHtmlTable(resultsHtml)
  console.log(`[ateasi] Parsed ${rows.length} rows from results table`)
  if (rows.length > 0) {
    console.log('[ateasi] First row sample:', JSON.stringify(rows[0]))
  }

  return rows.map(mapRow)
}
