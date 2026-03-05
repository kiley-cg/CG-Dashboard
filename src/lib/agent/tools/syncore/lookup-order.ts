import { registerTool } from '../registry'
import { lookupOrder } from '@/lib/syncore/client'

registerTool({
  name: 'lookup_order',
  description: 'Look up a Syncore order by Sales Order ID or Job ID. Tries SO ID first, falls back to Job ID lookup. Returns order metadata including the sales_order_id to use for fetching lines.',
  inputSchema: {
    type: 'object',
    properties: {
      order_number: { type: 'string', description: 'The SO ID or Job ID to look up' }
    },
    required: ['order_number']
  },
  execute: async (input) => {
    const { order_number } = input as { order_number: string }
    return await lookupOrder(order_number)
  }
})
