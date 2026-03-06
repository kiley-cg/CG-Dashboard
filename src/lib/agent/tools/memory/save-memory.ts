import { registerTool } from '../registry'
import { saveMemory } from '@/lib/memory/store'
import type { AgentMemory } from '@/lib/memory/store'

registerTool({
  name: 'save_memory',
  description: `Save a fact or observation to the shared organizational memory store. This memory persists across all sessions and is visible to all users' agent runs.

Use this to capture:
- Notable pricing decisions ("Applied 5% manual adjustment for Acme Corp contract pricing")
- Customer patterns ("Smith & Sons always orders Lights matrix for their light-colored shirts")
- Price corrections made by users ("PC54 Navy was corrected from $6.11 to $6.50 for order #1234")
- Vendor cost observations ("SanMar PC54 Navy cost increased from $3.85 to $4.10 as of this run")
- Any other fact worth remembering for future orders`,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['order', 'correction', 'preference', 'vendor_cost', 'general'],
        description: 'Category of memory'
      },
      content: {
        type: 'string',
        description: 'Plain-English description of what to remember. Written as if explaining it to a future agent who will read this.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Namespaced tags for retrieval. Use formats: "customer:Name", "style:PC54", "order:1234", "deco:screenPrint". These are how future runs will find this memory.'
      },
      data: {
        type: 'object',
        description: 'Optional structured data payload (prices, quantities, etc.)'
      }
    },
    required: ['type', 'content', 'tags']
  },
  execute: async (input) => {
    const { type, content, tags, data } = input as {
      type: AgentMemory['type']
      content: string
      tags: string[]
      data?: Record<string, unknown>
    }
    const id = await saveMemory({ type, content, tags, data: data || {}, source: 'agent' })
    return { saved: true, id, content }
  }
})
