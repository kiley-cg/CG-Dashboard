import { registerTool } from '../registry'
import { updateLinePrice } from '@/lib/syncore/client'

registerTool({
  name: 'set_line_price',
  description: 'Write a calculated price to a specific line item in a Syncore sales order. Only call this during the apply phase after the user has reviewed and approved the pricing proposal.',
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'number', description: 'The job ID (from lookup_order)' },
      sales_order_id: { type: 'number', description: 'The sales order ID (from lookup_order)' },
      line_id: { type: 'number', description: 'The line item ID' },
      price: { type: 'number', description: 'The calculated retail price per unit, rounded to 2 decimal places' },
      reason: { type: 'string', description: 'Brief explanation of how this price was calculated' }
    },
    required: ['job_id', 'sales_order_id', 'line_id', 'price']
  },
  execute: async (input) => {
    const { job_id, sales_order_id, line_id, price, reason } = input as { job_id: number; sales_order_id: number; line_id: number; price: number; reason?: string }
    await updateLinePrice(sales_order_id, line_id, price, job_id)
    return { success: true, line_id, price, reason }
  }
})
