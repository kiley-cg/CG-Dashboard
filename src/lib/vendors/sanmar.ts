import soap from 'soap'

let clientCache: soap.Client | null = null

const SOAP_TIMEOUT_MS = 20_000

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

async function getClient(): Promise<soap.Client> {
  if (clientCache) return clientCache
  const client = await withTimeout(
    soap.createClientAsync(process.env.SANMAR_PRICING_WSDL!),
    SOAP_TIMEOUT_MS,
    'SanMar WSDL fetch'
  )

  // node-soap nests methods under service/port instead of the root.
  // Hoist getPricingAsync to the root so call sites work uniformly.
  if (typeof (client as unknown as Record<string, unknown>).getPricingAsync !== 'function') {
    const desc = client.describe() as Record<string, Record<string, Record<string, unknown>>>
    const serviceName = Object.keys(desc)[0]
    const portName = serviceName ? Object.keys(desc[serviceName])[0] : undefined
    if (serviceName && portName) {
      const port = (client as unknown as Record<string, Record<string, Record<string, unknown>>>)[serviceName]?.[portName]
      if (port && typeof port.getPricingAsync === 'function') {
        ;(client as unknown as Record<string, unknown>).getPricingAsync =
          port.getPricingAsync.bind(port)
      } else {
        throw new Error(
          `SanMar SOAP client missing getPricingAsync. Services: ${JSON.stringify(Object.keys(desc))}` +
          (serviceName && portName ? `, Methods: ${JSON.stringify(Object.keys(port ?? {}))}` : '')
        )
      }
    }
  }

  clientCache = client
  return clientCache
}

/** Normalize size codes: "XXL" → "2XL", "XXXL" → "3XL", etc. */
function normalizeSize(size: string): string {
  const s = size.toUpperCase().trim()
  const aliases: Record<string, string> = {
    XXS: '2XS', S: 'S', M: 'M', L: 'L', XL: 'XL',
    XXL: '2XL', XXXL: '3XL', XXXXL: '4XL', XXXXXL: '5XL', XXXXXXL: '6XL',
  }
  return aliases[s] ?? s
}

/** Parse a price string/number, return null if zero or invalid */
function parsePrice(val: unknown): number | null {
  const n = parseFloat(String(val ?? ''))
  return isFinite(n) && n > 0 ? n : null
}

export async function getSanmarCost(
  style: string,
  color: string,
  size: string,
  _qty: number
): Promise<{ cost: number | null; error?: string }> {
  try {
    const client = await getClient()

    // SanMar Standard getPricing: arg0 = product lookup, arg1 = credentials.
    // Only send style/color/size — the extra response fields (casePrice, etc.)
    // cause a server-side NullPointerException when sent as empty strings.
    // Pass empty string for color/size to fetch all variants, then filter below.
    const normalizedSize = normalizeSize(size)
    const arg0 = {
      style,
      color: '',
      size: '',
    }
    const arg1 = {
      sanMarCustomerNumber: process.env.SANMAR_CUSTOMER_NUMBER ?? '',
      sanMarUserName: process.env.SANMAR_API_USER ?? '',
      sanMarUserPassword: process.env.SANMAR_API_PASSWORD ?? '',
    }

    const soapResult = await withTimeout(
      (client as unknown as Record<string, (a: unknown, b: unknown) => Promise<unknown[]>>)
        .getPricingAsync(arg0, arg1),
      SOAP_TIMEOUT_MS,
      'SanMar pricing call'
    )

    const result = soapResult[0] as Record<string, unknown> | undefined
    const ret = result?.return as Record<string, unknown> | undefined

    // Check for API-level error
    if (ret?.status === false || ret?.status === 'false') {
      return { cost: null, error: `SanMar API error: ${String(ret?.message ?? 'unknown')}` }
    }

    const listResponse = ret?.listResponse
    if (!listResponse) {
      return { cost: null, error: `SanMar returned no listResponse. Full result: ${JSON.stringify(result)}` }
    }

    const items = Array.isArray(listResponse) ? listResponse : [listResponse]
    if (items.length === 0) {
      return { cost: null, error: `SanMar returned empty listResponse for style=${style}` }
    }

    // Filter to matching color + size (case-insensitive).
    // SanMar color names may differ slightly (e.g. "Bright Red" vs "BRIGHT RED"),
    // so we normalize spaces and case for comparison.
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const targetColor = normalize(color)
    const targetSize = normalizedSize.toUpperCase()

    const matched = (items as Record<string, unknown>[]).filter(rec => {
      const c = normalize(String(rec.color ?? ''))
      const s = String(rec.size ?? '').toUpperCase().trim()
      return c === targetColor && s === targetSize
    })

    // Fall back to all items if no color+size match (so we always return something useful)
    const candidates = matched.length > 0 ? matched : (items as Record<string, unknown>[])

    for (const rec of candidates) {
      // Prefer myPrice (customer-negotiated net), then salePrice, then casePrice
      const cost = parsePrice(rec.myPrice) ?? parsePrice(rec.salePrice) ?? parsePrice(rec.casePrice)
      if (cost !== null) return { cost }
    }

    return {
      cost: null,
      error: `SanMar returned items but no valid price for style=${style} color=${color} size=${normalizedSize}. ` +
        `Matched ${matched.length}/${items.length} items. Sample: ${JSON.stringify(items.slice(0, 2))}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('SanMar SOAP error:', message)
    return { cost: null, error: `SanMar SOAP error: ${message}` }
  }
}
