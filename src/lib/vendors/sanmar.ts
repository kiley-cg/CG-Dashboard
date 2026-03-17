import soap from 'soap'

let clientCache: soap.Client | null = null

async function getClient(): Promise<soap.Client> {
  if (clientCache) return clientCache
  clientCache = await soap.createClientAsync(process.env.SANMAR_PRICING_WSDL!)
  return clientCache
}

export async function getSanmarCost(
  style: string,
  color: string,
  size: string,
  qty: number
): Promise<number | null> {
  try {
    const client = await getClient()
    const args = {
      wsVersion: '2.0.0',
      id: process.env.SANMAR_API_USER,
      password: process.env.SANMAR_API_PASSWORD,
      productId: style,
      partId: `${style}-${color}-${size}`,
      currency: 'USD',
      fobId: '1',
      priceType: 'Net',
      localizationCountry: 'US',
      localizationLanguage: 'en',
      configurationType: 'Decorated'
    }

    const [result] = await client.GetProductPricingAndConfigurationAsync(args)
    const parts = result?.GetProductPricingAndConfigurationResult?.Part || []
    const partArray = Array.isArray(parts) ? parts : [parts]

    for (const part of partArray) {
      const pricing = part?.PartPriceArray?.PartPrice
      if (!pricing) continue
      const prices = Array.isArray(pricing) ? pricing : [pricing]
      for (const p of prices) {
        const minQty = parseInt(p.minQuantity || '0')
        if (qty >= minQty) {
          const price = parseFloat(p.price || p.salePrice || '0')
          if (price > 0) return price
        }
      }
    }
    return null
  } catch (err) {
    console.error('SanMar SOAP error:', err)
    return null
  }
}
