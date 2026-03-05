import { registerTool } from '../registry'
import { getSanmarCost } from '@/lib/vendors/sanmar'

registerTool({
  name: 'get_vendor_cost_sanmar',
  description: 'Look up the current net cost for a garment from SanMar via the PromoStandards SOAP API. Pass the style number, color code, and size code as they appear in the Syncore line item SKU or supplier fields. Returns the net price per unit at the given quantity.',
  inputSchema: {
    type: 'object',
    properties: {
      style: { type: 'string', description: 'SanMar style number, e.g. "PC54"' },
      color: { type: 'string', description: 'Color code or name, e.g. "Navy"' },
      size: { type: 'string', description: 'Size code, e.g. "L", "XL", "2XL"' },
      quantity: { type: 'number', description: 'Total order quantity for pricing tier selection' }
    },
    required: ['style', 'color', 'size', 'quantity']
  },
  execute: async (input) => {
    const { style, color, size, quantity } = input as { style: string; color: string; size: string; quantity: number }
    const cost = await getSanmarCost(style, color, size, quantity)
    if (cost === null) return { cost: null, error: 'Could not retrieve SanMar cost — SOAP lookup failed or product not found' }
    return { cost, style, color, size, quantity }
  }
})
