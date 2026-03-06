/**
 * Diagnostic script to discover the correct Syncore API endpoint for SO lines.
 *
 * Usage (from project root, with .env.local in place):
 *   npx tsx scripts/probe-syncore-api.ts
 *
 * Set JOB_ID and SO_ID below to the order you tested with (31496 / 40454).
 */

const BASE = 'https://api.syncore.app/v2'
const JOB_ID = '31496'
const SO_ID = '40454'   // primary SO from the job lookup
const API_KEY = process.env.SYNCORE_API_KEY!

if (!API_KEY) {
  console.error('SYNCORE_API_KEY not set. Run with: SYNCORE_API_KEY=... npx tsx scripts/probe-syncore-api.ts')
  process.exit(1)
}

const h = { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }

async function probe(label: string, url: string) {
  try {
    const res = await fetch(url, { headers: h })
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = text }
    console.log(`\n[${res.status}] ${label}`)
    console.log(`  URL: ${url}`)
    if (res.ok) {
      // Print full response for successful hits
      console.log('  RESPONSE:', JSON.stringify(parsed, null, 2).slice(0, 2000))
    } else {
      console.log('  BODY:', text.slice(0, 300))
    }
    return res.ok ? parsed : null
  } catch (err) {
    console.log(`\n[ERR] ${label}: ${err}`)
    return null
  }
}

async function main() {
  console.log('=== Syncore API Endpoint Probe ===\n')
  console.log(`Job ID: ${JOB_ID}  |  SO ID: ${SO_ID}`)

  // 1. Fetch job — get raw structure to inspect what endpoints might exist
  const jobData = await probe('GET Job (baseline)', `${BASE}/orders/jobs/${JOB_ID}`)
  if (jobData) {
    console.log('\n--- Full job response (for endpoint discovery) ---')
    console.log(JSON.stringify(jobData, null, 2).slice(0, 5000))
  }

  // 2. Try every plausible line-items endpoint variant
  const candidates = [
    [`SO lines — /orders/sales-orders/{id}/lines`,           `${BASE}/orders/sales-orders/${SO_ID}/lines`],
    [`SO lines — /orders/sales-orders/{id}/line-items`,      `${BASE}/orders/sales-orders/${SO_ID}/line-items`],
    [`SO lines — /orders/sales-orders/{id}/items`,           `${BASE}/orders/sales-orders/${SO_ID}/items`],
    [`SO detail — /orders/sales-orders/{id}`,                `${BASE}/orders/sales-orders/${SO_ID}`],
    [`Job SO lines — /orders/jobs/{j}/sales-orders/{s}/lines`,`${BASE}/orders/jobs/${JOB_ID}/sales-orders/${SO_ID}/lines`],
    [`Job SO lines — /orders/jobs/{j}/sales-orders/{s}`,     `${BASE}/orders/jobs/${JOB_ID}/sales-orders/${SO_ID}`],
    [`Top-level SO — /sales-orders/{id}/lines`,              `${BASE}/sales-orders/${SO_ID}/lines`],
    [`Top-level SO — /sales-orders/{id}`,                    `${BASE}/sales-orders/${SO_ID}`],
    [`Top-level SO — /sales-orders/{id}/line-items`,         `${BASE}/sales-orders/${SO_ID}/line-items`],
  ] as [string, string][]

  for (const [label, url] of candidates) {
    await probe(label, url)
  }

  // 3. Try listing all SOs to see if there's a collection endpoint
  await probe('List all SOs', `${BASE}/orders/sales-orders?limit=5`)
  await probe('List all Jobs', `${BASE}/orders/jobs?limit=5`)
}

main()
