/**
 * Module-level cache so get_active_price_list and calculate_price
 * share the same loaded price list without the agent passing
 * thousands of tokens of matrix data as a tool argument.
 */
import type { PriceList } from '@/lib/pricing/types'

let cached: PriceList | null = null

export function setCachedPriceList(pl: PriceList): void {
  cached = pl
}

export function getCachedPriceList(): PriceList | null {
  return cached
}
