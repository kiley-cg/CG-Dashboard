import { registerTool } from '../registry'
import { searchMemories } from '@/lib/memory/store'

registerTool({
  name: 'search_memories',
  description: `Search the shared organizational memory store for relevant past context. Returns memories matching any of the provided tags, sorted by most recent first.

Use namespaced tag formats: "customer:Acme Corp", "style:PC54", "order:1234", "deco:screenPrint".

Call this when you want to check:
- Has this customer been priced before? Are there any notes about their preferences?
- Has this style/vendor been looked up before? Was there a cost discrepancy?
- Were there any corrections made on this order in a previous session?
- Are there any known patterns for this type of job?`,
  inputSchema: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to search for. Returns memories matching ANY of these tags. Use namespaced format: "customer:Name", "style:PC54", "order:1234"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memories to return (default: 10)'
      }
    },
    required: ['tags']
  },
  execute: async (input) => {
    const { tags, limit } = input as { tags: string[]; limit?: number }
    const memories = await searchMemories(tags, limit || 10)
    if (memories.length === 0) return { memories: [], message: 'No relevant memories found for these tags.' }
    return {
      memories: memories.map(m => ({
        id: m.id,
        type: m.type,
        content: m.content,
        tags: m.tags,
        data: m.data,
        createdAt: m.createdAt?.toDate?.()?.toISOString() || null
      })),
      count: memories.length
    }
  }
})
