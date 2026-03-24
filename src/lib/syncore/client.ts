const BASE = 'https://api.syncore.app/v2'

function headers() {
  return {
    'x-api-key': process.env.SYNCORE_API_KEY!,
    'Content-Type': 'application/json'
  }
}

export interface SOLine {
  line_id: number
  sku: string | null
  description: string | null
  quantity: number
  price_value: number | null
  cost_value: number | null
  supplier: string | null
  [key: string]: unknown
}

export interface OrderResult {
  type: 'sales_order' | 'job'
  soId: number
  jobId?: number
  customer?: string
  name?: string
  raw: unknown
}

// Normalise a raw line_items entry from the Syncore API into our SOLine shape.
// The API returns supplier as an object { id, name, ... } — we flatten to the name string.
function normaliseLines(raw: unknown[]): SOLine[] {
  return raw.map((item) => {
    const r = item as Record<string, unknown>
    const supplierRaw = r.supplier
    const supplier =
      supplierRaw && typeof supplierRaw === 'object'
        ? ((supplierRaw as Record<string, unknown>).name as string) ?? null
        : (supplierRaw as string | null) ?? null
    return { ...r, supplier } as SOLine
  })
}

export async function lookupOrder(id: string): Promise<OrderResult> {
  // Strip SO suffix to get job number (e.g. "32234-1" -> "32234")
  const jobId = id.includes('-') ? id.split('-')[0] : id

  // Use the documented endpoint: GET /v2/orders/jobs/{job_id}/salesorders
  // Returns an array of SO objects whose .id is the correct salesorder_id
  // for all subsequent /salesorders/{salesorder_id}/... calls.
  const soListRes = await fetch(`${BASE}/orders/jobs/${jobId}/salesorders`, { headers: headers() })
  if (soListRes.ok) {
    const list = await soListRes.json() as Record<string, unknown>[]
    const arr = Array.isArray(list) ? list : []
    if (arr.length > 0) {
      const so = arr[0]
      const soId = so.id as number
      const client = so.client as Record<string, unknown> | undefined
      return {
        type: 'job',
        soId,
        jobId: parseInt(jobId),
        customer: (client?.business_name || client?.name) as string | undefined,
        name: so.name as string | undefined,
        raw: so
      }
    }
  }

  throw new Error(`Order ${id} not found — GET /jobs/${jobId}/salesorders returned HTTP ${soListRes.status}`)
}

export async function getSalesOrderLines(soId: number, jobId?: number): Promise<SOLine[]> {
  if (!jobId) throw new Error(`job_id is required to fetch SO lines (SO ${soId})`)

  const res = await fetch(
    `${BASE}/orders/jobs/${jobId}/salesorders/${soId}/lineitems`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(`Failed to fetch line items for job ${jobId} / SO ${soId}: HTTP ${res.status}`)

  const data = await res.json() as unknown[]
  const items = Array.isArray(data) ? data : []
  return normaliseLines(items)
}

export async function updateLinePrice(
  soId: number,
  lineId: number,
  newPrice: number,
  jobId?: number
): Promise<void> {
  if (!jobId) throw new Error(`job_id is required to update line prices (SO ${soId})`)

  const res = await fetch(
    `${BASE}/orders/jobs/${jobId}/salesorders/${soId}/lineitems/${lineId}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ price_value: newPrice })
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to update line ${lineId} on job ${jobId} / SO ${soId}: HTTP ${res.status} - ${body}`)
  }
}
