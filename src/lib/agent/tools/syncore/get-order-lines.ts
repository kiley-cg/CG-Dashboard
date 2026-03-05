import { registerTool } from '../registry'
import { getSalesOrderLines } from '@/lib/syncore/client'

registerTool({
  name: 'get_sales_order_lines',
  description: 'Get all line items for a specific Syncore sales order. Returns lines with fields: line_id, sku, description, quantity, price_value, cost_value, supplier. Lines are either garment lines (have supplier/SKU like "SM-PC54-Navy-L") or decoration lines (describe a service like "Screen Print - 3 Colors - Darks" or "Embroidery - 8000 Stitches").',
  inputSchema: {
    type: 'object',
    properties: {
      sales_order_id: { type: 'number', description: 'The numeric sales order ID' }
    },
    required: ['sales_order_id']
  },
  execute: async (input) => {
    const { sales_order_id } = input as { sales_order_id: number }
    return await getSalesOrderLines(sales_order_id)
  }
})
