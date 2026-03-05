import { registerTool } from '../registry'
import { getActivePriceList } from '@/lib/pricing/firebase'

registerTool({
  name: 'get_active_price_list',
  description: 'Load the active pricing configuration from Firestore. Returns the full price list including screen print grids (Darks/Lights/Specialty), embroidery grids, patch grids, margin tiers, and markup percentages. Call this once at the start of pricing an order.',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async () => {
    return await getActivePriceList()
  }
})
