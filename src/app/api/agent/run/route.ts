import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/agent/runtime'
import { pricingTask } from '@/lib/agent/tasks/pricing'
import { searchMemories, saveOrderSummary } from '@/lib/memory/store'
import type { AgentTask, AgentEvent, PricingProposalLine } from '@/lib/agent/types'

// Registry of all available agent tasks
const tasks: Record<string, AgentTask> = {
  pricing: pricingTask
  // Future tasks registered here
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const { task: taskName, input, mode } = body as {
    task: string
    input: {
      orderNumber: string
      customerName?: string
      proposal?: PricingProposalLine[]
    }
    mode: 'propose' | 'apply'
  }

  const taskConfig = tasks[taskName]
  if (!taskConfig) {
    return new Response(`Unknown task: ${taskName}`, { status: 400 })
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
  if (mode === 'propose') {
    userMessage = `Please price sales order number: ${input.orderNumber}

Read all the line items, calculate the correct retail price for each one using the pricing matrices and current vendor costs, then output the [PROPOSAL] block with your calculated prices.

Do NOT call set_line_price yet — just calculate and propose.`
  } else if (mode === 'apply') {
    userMessage = `Apply the approved pricing to sales order number: ${input.orderNumber}

Here is the approved pricing proposal:
${JSON.stringify(input.proposal, null, 2)}

Please call set_line_price for each line in the proposal that does not have skip=true. Use the sales_order_id and lineId from the proposal.`
  } else {
    return new Response('Invalid mode', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

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
        })

        // AUTO-SAVE: After successful apply, persist a summary to shared organizational memory.
        // Failures are silent — memory save should never block the response.
        if (mode === 'apply' && (capturedProposal || input.proposal)) {
          const proposalToSave = capturedProposal || input.proposal!
          saveOrderSummary({
            orderNumber: input.orderNumber,
            customer: capturedCustomer || 'Unknown',
            lines: proposalToSave,
            source: 'pricing'
          }).catch(err => console.error('Memory auto-save failed (non-fatal):', err))
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
