import { registerTool } from '../registry'
import { getActivePriceList } from '@/lib/pricing/firebase'
import { setCachedPriceList } from './price-list-cache'

registerTool({
  name: 'get_active_price_list',
  description: 'Load the active pricing configuration from Firestore. Call this once at the start of pricing an order. After calling this, use calculate_price directly — it reads the price list from cache automatically.',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async () => {
    const pl = await getActivePriceList()
    setCachedPriceList(pl)
    // Return a lightweight summary instead of the full matrix data
    return {
      id: pl.id,
      name: pl.name,
      screenPrintMarkup: pl.screenPrintMarkup,
      embroideryMarkup: pl.embroideryMarkup,
      patchMarkup: pl.patchMarkup,
      screenPrintGrids: pl.screenPrintGrids?.map(g => g.name),
      embroideryGrids: pl.embroideryGrids?.map(g => g.name),
      patchGrids: pl.patchGrids?.map(g => g.name),
      marginTierCount: pl.marginGrids?.[0]?.tiers?.length ?? 0,
      additionalServices: pl.additionalServices ?? [],
      note: 'Full matrix data cached — call calculate_price directly.'
    }
  }
})
