const BASE = process.env.SS_API_BASE_URL || 'https://api.ssactivewear.com/v2'

interface SSPricingTier {
  minQty: number
  maxQty: number | null
  price: number
}

export async function getSSCost(
  style: string,
  color: string,
  size: string,
  qty: number
): Promise<number | null> {
  try {
    const credentials = Buffer.from(`${process.env.SS_CUSTOMER_NUMBER}:${process.env.SS_API_KEY}`).toString('base64')
    const res = await fetch(`${BASE}/products/${style}?fields=pricing`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    })
    if (!res.ok) return null

    const data = await res.json()
    const products = Array.isArray(data) ? data : [data]

    // Find matching product by color/size
    const match = products.find((p: Record<string, unknown>) => {
      const pColor = String(p.colorCode || p.color || '').toLowerCase()
      const pSize = String(p.sizeCode || p.size || '').toLowerCase()
      return pColor.includes(color.toLowerCase()) || pSize.includes(size.toLowerCase())
    }) || products[0]

    if (!match?.pricing) return null

    const tiers: SSPricingTier[] = match.pricing
    const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty)
    for (const tier of sorted) {
      if (qty >= tier.minQty) return tier.price
    }
    return tiers[0]?.price ?? null
  } catch (err) {
    console.error('S&S API error:', err)
    return null
  }
}
