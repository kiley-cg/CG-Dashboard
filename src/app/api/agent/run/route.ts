// Required for SOAP (node-soap uses Node.js-only APIs incompatible with Edge runtime)
export const runtime = 'nodejs'

import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/agent/runtime'
import { pricingTask } from '@/lib/agent/tasks/pricing'
import { searchMemories, saveOrderSummary } from '@/lib/memory/store'
import type { AgentTask, AgentEvent, PricingProposalLine, ChatMessage } from '@/lib/agent/types'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

// Registry of all available agent tasks
const tasks: Record<string, AgentTask> = {
  pricing: pricingTask
  // Future tasks registered here
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-extension-api-key')
  const session = await auth()
  if (!session?.user && apiKey !== process.env.EXTENSION_API_KEY) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  const body = await req.json()
  const { task: taskName, input, mode } = body as {
    task: string
    input: {
      orderNumber: string
      customerName?: string
      decorator?: string
      decorationType?: string
      gridName?: string
      proposal?: PricingProposalLine[]
      // chat mode only
      messages?: ChatMessage[]
      chatMessage?: string
      currentProposal?: PricingProposalLine[]
    }
    mode: 'propose' | 'apply' | 'chat'
  }

  const taskConfig = tasks[taskName]
  if (!taskConfig) {
    return new Response(`Unknown task: ${taskName}`, { status: 400, headers: CORS_HEADERS })
  }

  // AUTO-CONTEXT: Load relevant shared memories before the agent runs.
  // Query by order number and customer name if available.
  const memoryTags = [
    `order:${input.orderNumber}`,
    ...(input.customerName ? [`customer:${input.customerName}`] : [])
  ]

  const relevantMemories = await searchMemories(memoryTags, 15).catch(() => [])

  // Inject memories as a context block appended to the system prompt
  let taskWithMemory = taskConfig
  if (relevantMemories.length > 0) {
    const memoryBlock = relevantMemories
      .map(m => `- [${m.type}] ${m.content}`)
      .join('\n')
    taskWithMemory = {
      ...taskConfig,
      systemPrompt: taskConfig.systemPrompt +
        `\n\n## Organizational Memory (from past runs — all team members)\n${memoryBlock}`
    }
  }

  let userMessage: string
  let priorMessages: MessageParam[] | undefined

  if (mode === 'propose') {
    const decoHint = (input.decorator || input.decorationType)
      ? `\n\nUser-specified decoration details:${input.decorator ? ` Decorator: ${input.decorator}.` : ''}${input.decorationType ? ` Decoration type: ${input.decorationType}.` : ''}${input.gridName ? ` Grid: ${input.gridName}.` : ''} Use these when pricing decoration lines — do not try to infer them from the order.`
      : ''
    userMessage = `Please price sales order number: ${input.orderNumber}

Read all the line items, calculate the correct retail price for each one using the pricing matrices and current vendor costs, then output the [PROPOSAL] block with your calculated prices.

Do NOT call set_line_price yet — just calculate and propose.${decoHint}`
  } else if (mode === 'apply') {
    userMessage = `Apply the approved pricing to sales order number: ${input.orderNumber}

Here is the approved pricing proposal:
${JSON.stringify(input.proposal, null, 2)}

Please call set_line_price for each line in the proposal that does not have skip=true. Use the sales_order_id and lineId from the proposal.`
  } else if (mode === 'chat') {
    // Build context block from current proposal
    const proposalContext = input.currentProposal?.length
      ? `\n\n## Current Pricing Proposal (order #${input.orderNumber})\n` +
        input.currentProposal.map(l =>
          `  Line ${l.lineId} [${l.lineType}]: ${l.description ?? l.sku} — ` +
          (l.skip ? 'SKIPPED' : `$${l.calculatedPrice.toFixed(2)} (${l.breakdown})`)
        ).join('\n')
      : ''

    taskWithMemory = {
      ...taskWithMemory,
      systemPrompt: taskWithMemory.systemPrompt + proposalContext + `

## Refinement Mode
You are refining or explaining pricing for order #${input.orderNumber}. The proposal above is already calculated.
- Answer questions about how prices were determined.
- If the user asks you to change something (different matrix, markup, recalculate a line, etc.), use calculate_price and output a complete updated [PROPOSAL] block.
- Only call lookup_order / get_sales_order_lines if the user explicitly asks about order details you don't have.
- Do NOT call set_line_price — that happens separately when the user clicks Apply.`
    }

    // Convert text-only conversation history into Anthropic message params
    priorMessages = (input.messages ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    userMessage = input.chatMessage ?? ''
  } else {
    return new Response('Invalid mode', { status: 400, headers: CORS_HEADERS })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Send SSE keepalive comments every 15s to prevent proxy/CDN timeouts
      // during long tool calls (SOAP lookups, Anthropic API waits, etc.)
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch { /* stream closed */ }
      }, 15_000)

      let capturedProposal: PricingProposalLine[] | null = null
      let capturedCustomer: string | null = input.customerName || null

      try {
        await runAgent(taskWithMemory, userMessage, (event) => {
          // Parse [PROPOSAL] blocks from reasoning text
          if (event.type === 'reasoning') {
            const proposalMatch = event.text.match(/\[PROPOSAL\]([\s\S]*?)\[\/PROPOSAL\]/)
            if (proposalMatch) {
              try {
                const parsed = JSON.parse(proposalMatch[1].trim())
                if (parsed.lines) {
                  capturedProposal = parsed.lines
                  if (parsed.customer) capturedCustomer = parsed.customer
                  send({ type: 'proposal', lines: parsed.lines })
                  const cleanText = event.text.replace(/\[PROPOSAL\][\s\S]*?\[\/PROPOSAL\]/, '').trim()
                  if (cleanText) send({ ...event, text: cleanText })
                  return
                }
              } catch {
                // Not valid JSON, pass through as text
              }
            }
          }

          // Capture proposal from explicit proposal events too
          if (event.type === 'proposal') {
            capturedProposal = event.lines
          }

          send(event)
        }, priorMessages)

        // AUTO-SAVE: Persist a pricing summary to shared organizational memory.
        // On apply: save the final applied prices. On propose: save the proposal so future
        // runs have context even if apply never completed. Failures are non-fatal.
        const proposalToSave = mode !== 'chat' && (capturedProposal || (mode === 'apply' ? input.proposal : null))
        if (proposalToSave) {
          saveOrderSummary({
            orderNumber: input.orderNumber,
            customer: capturedCustomer || 'Unknown',
            lines: proposalToSave,
            source: mode === 'apply' ? 'pricing:applied' : 'pricing:proposed'
          }).catch(err => console.error('Memory auto-save failed (non-fatal):', err))
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        clearInterval(keepalive)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
