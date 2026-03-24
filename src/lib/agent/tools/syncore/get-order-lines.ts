import { registerTool } from '../registry'
import { getSalesOrderLines } from '@/lib/syncore/client'

registerTool({
  name: 'get_sales_order_lines',
  description: 'Get all line items for a specific Syncore sales order. Returns lines with fields: line_id, sku, description, quantity, price_value, cost_value, supplier. Lines are either garment lines (have supplier/SKU like "SM-PC54-Navy-L") or decoration lines (describe a service like "Screen Print - 3 Colors - Darks" or "Embroidery - 8000 Stitches"). If lookup_order returned a jobId, pass it as job_id so alternate endpoints can be tried if the primary one fails.',
  inputSchema: {
    type: 'object',
    properties: {
      sales_order_id: { type: 'number', description: 'The numeric sales order ID from lookup_order' },
      job_id: { type: 'number', description: 'The job ID from lookup_order (if available) — used as fallback if the primary endpoint fails' }
    },
    required: ['sales_order_id']
  },
  execute: async (input) => {
    const { sales_order_id, job_id } = input as { sales_order_id: number; job_id?: number }
    return await getSalesOrderLines(sales_order_id, job_id)
  }
})
