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

// us. is the classic-ASP app with the actual data. www. is the ASP.NET MVC
// auth gateway. Login must start from us. so the ReturnUrl carries us back
// here after www. authenticates the user.
const SITE = 'https://us.ateasesystems.net'
const AUTH_SITE = 'https://www.ateasesystems.net'

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

  // Step 1: Hit us. first (redirect: manual) to capture the ReturnUrl that
  // www. will honour after successful login, sending us back to us.ateasesystems.net.
  console.log(`[ateasi] GET ${SITE}/index.asp`)
  const usRes = await fetch(`${SITE}/index.asp`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; automation)' },
    redirect: 'manual',
  })
  storeCookies(usRes)
  console.log(`[ateasi] us. → HTTP ${usRes.status} Location: ${usRes.headers.get('location') ?? '(none)'} Cookies: ${Object.keys(sessionCookies).join(', ')}`)

  // Step 2: Follow the redirect chain from us./Login.asp until we reach the
  // actual www. login form (a 200 page with a password input).
  const usLocation = usRes.headers.get('location')
  let loginPageUrl = usLocation
    ? resolveUrl(`${SITE}/index.asp`, usLocation)
    : `${AUTH_SITE}/Account/Login`

  let loginHtml = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    console.log(`[ateasi] login form seek ${attempt + 1} → GET ${loginPageUrl}`)
    const r = await fetch(loginPageUrl, {
      headers: { 'Cookie': cookieHeader(), 'User-Agent': 'Mozilla/5.0 (compatible; automation)' },
      redirect: 'manual',
    })
    storeCookies(r)
    const body = await r.text()
    const hasPass = /type=["']password["']/i.test(body)
    console.log(`[ateasi]   → HTTP ${r.status} | has-password:${hasPass}`)

    if (r.status === 200 && hasPass) {
      loginHtml = body
      break
    }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location')
      if (!loc) throw new Error('Redirect with no Location header while seeking login form')
      loginPageUrl = resolveUrl(loginPageUrl, loc)
      continue
    }
    if (r.status === 200) {
      // Got 200 but no password field — take whatever we have and try anyway
      loginHtml = body
      break
    }
  }

  if (!/type=["']password["']/i.test(loginHtml)) {
    throw new Error(`Could not find login form with password field. Last URL: ${loginPageUrl}\nPage start: ${loginHtml.slice(0, 400)}`)
  }

  // Step 3: Build and submit the login form
  const fields = extractFormDefaults(loginHtml)
  const csrfToken = extractAntiForgery(loginHtml)
  if (csrfToken) fields['__RequestVerificationToken'] = csrfToken

  const usernameField = Object.keys(fields).find(k => /^(email|username|user|login)$/i.test(k)) ?? 'Email'
  const passwordField = Object.keys(fields).find(k => /^(password|pass|pwd)$/i.test(k)) ?? 'Password'
  fields[usernameField] = email
  fields[passwordField] = password

  console.log(`[ateasi] form fields (no password): ${Object.keys(fields).filter(k => k !== passwordField).map(k => `${k}=${fields[k].slice(0,40)}`).join(', ')}`)

  const actionM = loginHtml.match(/<form[^>]+action=["']([^"']+)["']/i)
  const actionUrl = actionM ? resolveUrl(loginPageUrl, actionM[1]) : loginPageUrl

  console.log(`[ateasi] POST ${actionUrl}`)
  const postRes = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader(),
      'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      'Referer': loginPageUrl,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  })
  storeCookies(postRes)
  console.log(`[ateasi] Login POST → HTTP ${postRes.status} Location: ${postRes.headers.get('location') ?? '(none)'} Cookies: ${Object.keys(sessionCookies).join(', ')}`)

  if (postRes.status >= 400) {
    const body = await postRes.text()
    throw new Error(`Login failed: HTTP ${postRes.status}\n${body.slice(0, 500)}`)
  }

  if (postRes.status === 200) {
    // A 200 on the POST means login was rejected (form re-displayed with error)
    const body = await postRes.text()
    const errM = body.match(/class=["'][^"']*validation[^"']*["'][^>]*>([\s\S]{0,200})</)
    throw new Error(`Login rejected (credentials wrong?): ${errM ? errM[1].replace(/<[^>]+>/g, '').trim() : body.slice(0, 300)}`)
  }

  // Step 4: Follow the post-login redirect chain; www. should eventually
  // redirect back to us.ateasesystems.net, establishing a session there.
  let location = postRes.headers.get('location')
  let currentUrl = actionUrl
  let hops = 0
  while (location && hops++ < 15) {
    currentUrl = resolveUrl(currentUrl, location)
    console.log(`[ateasi] redirect hop ${hops} → ${currentUrl}`)
    const r = await fetch(currentUrl, {
      headers: {
        'Cookie': cookieHeader(),
        'User-Agent': 'Mozilla/5.0 (compatible; automation)',
      },
      redirect: 'manual',
    })
    storeCookies(r)
    location = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null
    console.log(`[ateasi]   → ${r.status} ${location ?? '(done)'} | Cookies: ${Object.keys(sessionCookies).join(', ')}`)
  }

  loggedIn = true
  console.log('[ateasi] Login successful')
}

// ── Authenticated GET ─────────────────────────────────────────────────────────
// Use redirect:'manual' throughout so our Cookie header is never stripped by
// Node's fetch when following cross-origin or same-origin redirect hops.

async function authedGet(pathOrUrl: string, maxRedirects = 10): Promise<Response> {
  let currentUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE}${pathOrUrl}`

  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      headers: {
        'Cookie': cookieHeader(),
        'User-Agent': 'Mozilla/5.0 (compatible; automation)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'manual',
    })
    storeCookies(res)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      currentUrl = resolveUrl(currentUrl, location)
      continue
    }
    return res
  }
  throw new Error(`Too many redirects for ${pathOrUrl}`)
}

// ── Find Graphic Services URL ─────────────────────────────────────────────────

async function findGraphicServicesUrl(): Promise<string> {
  if (graphicServicesUrl) return graphicServicesUrl

  // Scan multiple us. pages for nav links — also look for any link containing "graphic"
  const navPages = ['/index.asp', '/default.asp', '/home.asp', '/main.asp']
  for (const navPath of navPages) {
    const res = await authedGet(navPath)
    if (res.status !== 200) continue
    const html = await res.text()
    const snippet = html.slice(0, 500).replace(/\s+/g, ' ')
    console.log(`[ateasi] GET ${navPath} → HTTP ${res.status} | ${snippet}`)

    // Print all links for diagnostic visibility
    const linkRe = /href=["']([^"'#?][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    const allLinks: string[] = []
    while ((m = linkRe.exec(html)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').trim()
      if (text) allLinks.push(`${text.slice(0, 50)} → ${m[1]}`)
      // Match "graphic services", "graphics", "graphic", etc.
      if (/graphic/i.test(text) || /graphic/i.test(m[1])) {
        graphicServicesUrl = resolveUrl(res.url, m[1])
        console.log(`[ateasi] Found Graphic Services link: "${text}" → ${graphicServicesUrl}`)
        return graphicServicesUrl
      }
    }
    if (allLinks.length > 0) {
      console.log(`[ateasi] All links on ${navPath} (${allLinks.length}):`, allLinks.slice(0, 50).join(' | '))
    }
  }

  // Fallback — try common classic-ASP paths on us. and print full error for diagnosis
  const fallbacks = [
    '/graphic_services.asp',
    '/graphicservices.asp',
    '/graphics_services.asp',
    '/graphic.asp',
    '/jobs_graphic.asp',
    '/graphic_jobs.asp',
    '/services_graphic.asp',
    '/JobGraphicServices.asp',
    '/job_graphic_services.asp',
  ]
  for (const path of fallbacks) {
    const r = await authedGet(path)
    const text = await r.text()
    console.log(`[ateasi] GET ${path} → ${r.status} | ${text.slice(0, 300).replace(/\s+/g, ' ')}`)
    // Accept if it's not just an error page
    if (r.status === 200 && /graphic/i.test(text) && !/@ease v1 - An error occurred/i.test(text)) {
      graphicServicesUrl = `${SITE}${path}`
      console.log(`[ateasi] Found Graphic Services URL (fallback): ${graphicServicesUrl}`)
      return graphicServicesUrl
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
