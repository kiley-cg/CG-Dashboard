const BASE = process.env.SS_API_BASE_URL || 'https://api.ssactivewear.com/v2'

export async function getSSCost(
  style: string,
  color: string,
  size: string,
  _qty: number
): Promise<number | null> {
  try {
    const customerNumber = process.env.SS_CUSTOMER_NUMBER
    const apiKey = process.env.SS_API_KEY
    if (!customerNumber || !apiKey) {
      console.error('S&S API: SS_CUSTOMER_NUMBER or SS_API_KEY not set')
      return null
    }

    const credentials = Buffer.from(`${customerNumber}:${apiKey}`).toString('base64')

    const res = await fetch(`${BASE}/products/${encodeURIComponent(style)}`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      console.error(`S&S API ${res.status} for style ${style}`)
      return null
    }

    const data = await res.json()
    const variants: Record<string, unknown>[] = Array.isArray(data) ? data : [data]

    if (variants.length === 0) return null

    const colorLower = color.toLowerCase()
    const sizeLower = size.toLowerCase()

    // Try exact color+size match first
    let match = variants.find(v => {
      const c = String(v.colorCode || v.colorName || v.color || '').toLowerCase()
      const s = String(v.sizeCode || v.sizeName || v.size || '').toLowerCase()
      return c.includes(colorLower) && s.includes(sizeLower)
    })

    // Fall back to color-only match (price doesn't vary by size at S&S)
    if (!match) {
      match = variants.find(v => {
        const c = String(v.colorCode || v.colorName || v.color || '').toLowerCase()
        return c.includes(colorLower)
      })
    }

    // Last resort: first variant
    if (!match) match = variants[0]
    if (!match) return null

    // S&S v2 API returns yourPrice (account price), salePrice, or price fields
    const price = match.yourPrice ?? match.salePrice ?? match.price1 ?? match.price
    return price != null ? Number(price) : null
  } catch (err) {
    console.error('S&S API error:', err)
    return null
  }
}
