import { registerTool } from '../registry'
import { getSSCost } from '@/lib/vendors/ss'

registerTool({
  name: 'get_vendor_cost_ss',
  description: 'Look up the current net cost for a garment from S&S Activewear via their REST API. Pass the style number, color code, and size code. Returns the net price per unit at the given quantity.',
  inputSchema: {
    type: 'object',
    properties: {
      style: { type: 'string', description: 'S&S style number, e.g. "3001C"' },
      color: { type: 'string', description: 'Color code or name' },
      size: { type: 'string', description: 'Size code, e.g. "L", "XL", "2XL"' },
      quantity: { type: 'number', description: 'Total order quantity for pricing tier selection' }
    },
    required: ['style', 'color', 'size', 'quantity']
  },
  execute: async (input) => {
    const { style, color, size, quantity } = input as { style: string; color: string; size: string; quantity: number }
    const cost = await getSSCost(style, color, size, quantity)
    if (cost === null) return { cost: null, error: 'Could not retrieve S&S cost — API lookup failed or product not found' }
    return { cost, style, color, size, quantity }
  }
})
