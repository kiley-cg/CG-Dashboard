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

  // node-soap sometimes nests methods under service/port instead of the root.
  // If the method isn't at the root level, hoist it so call sites work uniformly.
  if (typeof (client as unknown as Record<string, unknown>).GetProductPricingAndConfigurationAsync !== 'function') {
    const desc = client.describe() as Record<string, Record<string, Record<string, unknown>>>
    const serviceName = Object.keys(desc)[0]
    const portName = serviceName ? Object.keys(desc[serviceName])[0] : undefined
    if (serviceName && portName) {
      const port = (client as unknown as Record<string, Record<string, Record<string, unknown>>>)[serviceName]?.[portName]
      if (port && typeof port.GetProductPricingAndConfigurationAsync === 'function') {
        // Hoist to root
        (client as unknown as Record<string, unknown>).GetProductPricingAndConfigurationAsync =
          port.GetProductPricingAndConfigurationAsync.bind(port)
      } else {
        throw new Error(
          `SanMar SOAP client missing method. Services: ${JSON.stringify(Object.keys(desc))}` +
          (serviceName && portName ? `, Methods: ${JSON.stringify(Object.keys(port ?? {}))}` : '')
        )
      }
    }
  }

  clientCache = client
  return clientCache
}

/** Normalize size codes: "2XL" → "2XL", "XXL" → "2XL", etc. */
function normalizeSize(size: string): string {
  const s = size.toUpperCase().trim()
  const aliases: Record<string, string> = {
    XXS: '2XS', S: 'S', M: 'M', L: 'L', XL: 'XL',
    XXL: '2XL', XXXL: '3XL', XXXXL: '4XL', XXXXXL: '5XL', XXXXXXL: '6XL',
  }
  return aliases[s] ?? s
}

/** Pick the best price tier: highest quantityMin that is still ≤ requested qty */
function bestPrice(
  pricing: Record<string, unknown> | Record<string, unknown>[],
  qty: number
): number | null {
  const prices = Array.isArray(pricing) ? pricing : [pricing]
  let best: number | null = null
  let bestMin = -1

  for (const p of prices) {
    // PromoStandards v2 uses quantityMin; some implementations expose minQuantity
    const minQty = parseInt(String(p.quantityMin ?? p.minQuantity ?? 0))
    if (qty >= minQty && minQty > bestMin) {
      const price = parseFloat(String(p.price ?? p.salePrice ?? p.netPrice ?? 0))
      if (price > 0) {
        best = price
        bestMin = minQty
      }
    }
  }
  return best
}

export async function getSanmarCost(
  style: string,
  color: string,
  size: string,
  qty: number
): Promise<{ cost: number | null; error?: string }> {
  try {
    const client = await getClient()
    const args = {
      wsVersion: '2.0.0',
      id: process.env.SANMAR_API_USER,
      password: process.env.SANMAR_API_PASSWORD,
      productId: style,
      // Don't pass partId — fetch all parts for the style and filter client-side.
      // SanMar's internal part IDs use color codes, not color names.
      partId: '',
      currency: 'USD',
      fobId: '',
      priceType: 'Net',
      localizationCountry: 'US',
      localizationLanguage: 'en',
      configurationType: 'Decorated',
    }

    const soapResult = await withTimeout(
      client.GetProductPricingAndConfigurationAsync(args) as Promise<unknown[]>,
      SOAP_TIMEOUT_MS,
      'SanMar pricing call'
    )

    const result = soapResult[0] as Record<string, unknown> | undefined
    const rawParts =
      (result?.GetProductPricingAndConfigurationResult as Record<string, unknown>)?.Part
    if (!rawParts) {
      const errData = result?.GetProductPricingAndConfigurationResult as Record<string, unknown>
      const errMsg = errData?.errorMessage ?? errData?.serviceMessageArray ?? 'No parts returned'
      return { cost: null, error: `SanMar returned no parts: ${JSON.stringify(errMsg)}` }
    }

    const partArray = Array.isArray(rawParts) ? rawParts : [rawParts]
    const normalizedSize = normalizeSize(size)
    const colorLower = color.toLowerCase().replace(/[-_\s]+/g, ' ').trim()

    // Find the part matching our color + size
    for (const part of partArray) {
      const partId = String(part.partId ?? '')
      // partId format is typically "STYLE-COLORCODE-SIZE" — match on size suffix
      const partSizeMatch = partId.split('-').pop()?.toUpperCase()
      const normalizePartSize = partSizeMatch ? normalizeSize(partSizeMatch) : ''

      // Match by description if available (color name is in partDescription)
      const description = String(part.partDescription ?? '').toLowerCase()
      const sizeMatch =
        normalizePartSize === normalizedSize ||
        description.includes(normalizedSize.toLowerCase())
      const colorMatch =
        description.includes(colorLower) ||
        colorLower.split(' ').every(word => description.includes(word))

      if (!sizeMatch || !colorMatch) continue

      const pricing = (part as Record<string, unknown>)?.PartPriceArray
        ? ((part as Record<string, Record<string, unknown>>).PartPriceArray?.PartPrice)
        : null
      if (!pricing) continue

      const price = bestPrice(pricing as Record<string, unknown> | Record<string, unknown>[], qty)
      if (price !== null) return { cost: price }
    }

    // Nothing matched — return diagnostic info
    const partSummary = partArray.slice(0, 5).map(p => ({
      partId: (p as Record<string, unknown>).partId,
      desc: (p as Record<string, unknown>).partDescription,
    }))
    return {
      cost: null,
      error: `No matching part for style=${style} color="${color}" size=${normalizedSize}. Sample parts: ${JSON.stringify(partSummary)}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('SanMar SOAP error:', message)
    return { cost: null, error: `SanMar SOAP error: ${message}` }
  }
}
