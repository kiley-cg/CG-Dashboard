import soap from 'soap'

let clientCache: soap.Client | null = null

const SOAP_TIMEOUT_MS = 15_000

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
  clientCache = await withTimeout(
    soap.createClientAsync(process.env.SANMAR_PRICING_WSDL!),
    SOAP_TIMEOUT_MS,
    'SanMar WSDL fetch'
  )
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

    const [result] = await withTimeout(
      client.GetProductPricingAndConfigurationAsync(args),
      SOAP_TIMEOUT_MS,
      'SanMar pricing call'
    )
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
