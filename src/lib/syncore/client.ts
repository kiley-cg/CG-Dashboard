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

  // Try job lookup first using the documented endpoint
  const jobRes = await fetch(`${BASE}/orders/jobs/${jobId}`, { headers: headers() })
  if (jobRes.ok) {
    const job = await jobRes.json() as Record<string, unknown>
    const salesOrders = (
      (job.sales_orders || job.salesOrders || []) as { id: number }[]
    )
    if (salesOrders.length > 0) {
      const soId = salesOrders[0].id
      const client = job.client as Record<string, unknown> | undefined
      return {
        type: 'job',
        soId,
        jobId: parseInt(jobId),
        customer: (client?.business_name || client?.name) as string | undefined,
        name: job.name as string | undefined,
        raw: job
      }
    }
  }

  // If no job found, also try the sales orders list for the job
  const soListRes = await fetch(`${BASE}/orders/jobs/${jobId}/salesorders`, { headers: headers() })
  if (soListRes.ok) {
    const list = await soListRes.json() as { id: number }[]
    const arr = Array.isArray(list) ? list : []
    if (arr.length > 0) {
      return {
        type: 'job',
        soId: arr[0].id,
        jobId: parseInt(jobId),
        raw: list
      }
    }
  }

  throw new Error(`Order ${id} not found (tried job ${jobId}: HTTP ${jobRes.status})`)
}

export async function getSalesOrderLines(soId: number, jobId?: number): Promise<SOLine[]> {
  // Primary: documented endpoint GET /v2/orders/jobs/{job_id}/salesorders/{salesorder_id}
  if (jobId) {
    const res = await fetch(`${BASE}/orders/jobs/${jobId}/salesorders/${soId}`, { headers: headers() })
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      const items = data.line_items as unknown[] | undefined
      if (Array.isArray(items) && items.length > 0) return normaliseLines(items)
    }
  }

  throw new Error(`Failed to fetch lines for SO ${soId}${jobId ? ` / job ${jobId}` : ''}`)
}

export async function updateLinePrice(soId: number, lineId: number, newPrice: number): Promise<void> {
  const res = await fetch(`${BASE}/orders/sales-orders/${soId}/lines/${lineId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ price_value: newPrice })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to update line ${lineId} on SO ${soId}: HTTP ${res.status} - ${body}`)
  }
}
