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

export async function lookupOrder(id: string): Promise<OrderResult> {
  // Try SO ID first
  const soRes = await fetch(`${BASE}/orders/sales-orders/${id}/lines`, { headers: headers() })
  if (soRes.ok) {
    const lines = await soRes.json()
    if (Array.isArray(lines) && lines.length >= 0) {
      return { type: 'sales_order', soId: parseInt(id), raw: lines }
    }
  }

  // Fall back to Job ID — also try stripping the SO suffix (e.g. "32234-1" -> "32234")
  const baseId = id.includes('-') ? id.split('-')[0] : id
  const jobRes = await fetch(`${BASE}/orders/jobs/${baseId}`, { headers: headers() })
  if (!jobRes.ok) throw new Error(`Order ${id} not found as SO or Job (HTTP ${jobRes.status})`)
  const job = await jobRes.json()

  const salesOrders: { id: number }[] = job.sales_orders || job.salesOrders || []
  if (salesOrders.length === 0) throw new Error(`Job ${id} has no sales orders`)

  const soId = salesOrders[0].id
  return {
    type: 'job',
    soId,
    jobId: job.id,
    customer: job.customer?.name || job.customerName,
    name: job.name || job.title,
    raw: job
  }
}

export async function getSalesOrderLines(soId: number): Promise<SOLine[]> {
  const res = await fetch(`${BASE}/orders/sales-orders/${soId}/lines`, { headers: headers() })
  if (!res.ok) throw new Error(`Failed to fetch SO ${soId} lines: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.lines || data.data || [])
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
