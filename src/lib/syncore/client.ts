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
  soNumber?: number   // SO sequential number within the job (may differ from soId)
  jobId?: number
  customer?: string
  name?: string
  raw: unknown
}

// Normalise raw line items: flatten nested supplier object to supplier.name string.
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

  // Documented endpoint: GET /v2/orders/jobs/{job_id}/salesorders
  const soListRes = await fetch(`${BASE}/orders/jobs/${jobId}/salesorders`, { headers: headers() })
  if (!soListRes.ok) {
    const body = await soListRes.text().catch(() => '')
    throw new Error(`Order ${id} not found — GET /jobs/${jobId}/salesorders returned HTTP ${soListRes.status}: ${body}`)
  }

  const list = await soListRes.json() as Record<string, unknown>[]
  const arr = Array.isArray(list) ? list : []
  if (arr.length === 0) throw new Error(`Job ${jobId} has no sales orders`)

  const so = arr[0]
  const soId = so.id as number
  const soNumber = so.number as number | undefined
  const client = so.client as Record<string, unknown> | undefined

  return {
    type: 'job',
    soId,
    soNumber,
    jobId: parseInt(jobId),
    customer: (client?.business_name || client?.name) as string | undefined,
    name: so.name as string | undefined,
    raw: so
  }
}

export async function getSalesOrderLines(soId: number, jobId?: number, soNumber?: number): Promise<SOLine[]> {
  if (!jobId) throw new Error(`job_id is required to fetch SO lines (SO ${soId})`)

  // Try all plausible salesorder_id formats: database id, sequential number, and suffix-1 form
  const soIds = [...new Set([soId, soNumber, 1].filter((v): v is number => v !== undefined))]
  const errors: string[] = []

  for (const sid of soIds) {
    const url = `${BASE}/orders/jobs/${jobId}/salesorders/${sid}/lineitems`
    const res = await fetch(url, { headers: headers() })
    if (res.ok) {
      const data = await res.json() as unknown[]
      const items = Array.isArray(data) ? data : []
      return normaliseLines(items)
    }
    const body = await res.text().catch(() => '')
    errors.push(`${sid}→${res.status}${body ? ': ' + body.slice(0, 120) : ''}`)
  }

  throw new Error(`Failed to fetch line items for job ${jobId} / SO ${soId}. Tried salesorder_ids [${soIds.join(', ')}]: ${errors.join(' | ')}`)
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
