import Anthropic from '@anthropic-ai/sdk'
import type { AgentTask, AgentEvent } from './types'
import { getTool, getToolDefs } from './tools/registry'
// Side-effect import: registers all tools into the registry
import './tools/init'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runAgent(
  task: AgentTask,
  userMessage: string,
  onEvent: (event: AgentEvent) => void,
  priorMessages?: Anthropic.MessageParam[]
): Promise<void> {
  const messages: Anthropic.MessageParam[] = [
    ...(priorMessages ?? []),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  const MAX_ITERATIONS = 30

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: task.systemPrompt,
      tools: getToolDefs(task.tools) as Anthropic.Tool[],
      messages
    })

    // Emit text reasoning blocks to the UI
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        onEvent({ type: 'reasoning', text: block.text })
      }
    }

    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('\n')
      onEvent({ type: 'complete', summary: text })
      break
    }

    if (response.stop_reason !== 'tool_use') {
      onEvent({ type: 'complete', summary: 'Agent finished.' })
      break
    }

    // Execute all tool calls
    const toolResultContent: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      onEvent({ type: 'tool_call', name: block.name, input: block.input })

      let result: unknown
      try {
        const tool = getTool(block.name)
        result = await tool.execute(block.input)
      } catch (err) {
        result = { error: String(err) }
      }

      onEvent({ type: 'tool_result', name: block.name, result })

      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result)
      })
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResultContent })
  }

  if (iterations >= MAX_ITERATIONS) {
    onEvent({ type: 'error', message: 'Agent reached maximum iteration limit' })
  }
}
