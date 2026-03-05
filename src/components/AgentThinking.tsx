'use client'

import type { AgentEvent } from '@/lib/agent/types'

interface AgentThinkingProps {
  events: AgentEvent[]
  isRunning: boolean
}

const TOOL_LABELS: Record<string, string> = {
  lookup_order: 'Looking up order',
  get_sales_order_lines: 'Fetching line items',
  get_active_price_list: 'Loading price list',
  get_vendor_cost_sanmar: 'Fetching SanMar cost',
  get_vendor_cost_ss: 'Fetching S&S cost',
  calculate_price: 'Calculating price',
  set_line_price: 'Writing price to order'
}

export function AgentThinking({ events, isRunning }: AgentThinkingProps) {
  if (events.length === 0 && !isRunning) return null

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-sm font-medium text-gray-300">
          {isRunning ? 'Agent is working...' : 'Agent complete'}
        </span>
      </div>

      <div className="p-4 space-y-3 max-h-96 overflow-y-auto font-mono text-sm">
        {events.map((event, i) => (
          <EventLine key={i} event={event} />
        ))}
        {isRunning && (
          <div className="text-gray-500 animate-pulse">▊</div>
        )}
      </div>
    </div>
  )
}

function EventLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'reasoning':
      return (
        <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
          {event.text}
        </div>
      )

    case 'tool_call': {
      const label = TOOL_LABELS[event.name] || event.name
      return (
        <div className="flex items-center gap-2 text-yellow-400">
          <span>→</span>
          <span className="font-semibold">{label}</span>
          <span className="text-gray-500 text-xs">{formatInput(event.name, event.input)}</span>
        </div>
      )
    }

    case 'tool_result': {
      const ok = !hasError(event.result)
      return (
        <div className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
          <span>{ok ? '✓' : '✗'}</span>
          <span>{ok ? formatResult(event.name, event.result) : formatError(event.result)}</span>
        </div>
      )
    }

    case 'error':
      return (
        <div className="text-red-400 font-semibold">Error: {event.message}</div>
      )

    default:
      return null
  }
}

function formatInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const i = input as Record<string, unknown>
  if (toolName === 'lookup_order') return `#${i.order_number}`
  if (toolName === 'get_sales_order_lines') return `SO ${i.sales_order_id}`
  if (toolName.includes('vendor_cost_sanmar')) return `${i.style} ${i.color} ${i.size} (${i.quantity} units)`
  if (toolName.includes('vendor_cost_ss')) return `${i.style} ${i.color} ${i.size} (${i.quantity} units)`
  if (toolName === 'calculate_price') return `${i.line_type} qty=${i.quantity}${i.row_key ? ` row=${i.row_key}` : ''}`
  if (toolName === 'set_line_price') return `line ${i.line_id} → $${(i.price as number)?.toFixed(2)}`
  return ''
}

function formatResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return 'OK'
  const r = result as Record<string, unknown>
  if (r.cost !== undefined && r.cost !== null) return `$${(r.cost as number).toFixed(2)}`
  if (r.price !== undefined) return `$${(r.price as number).toFixed(2)} — ${r.breakdown}`
  if (r.soId !== undefined) return `SO ${r.soId}${r.jobId ? ` (Job ${r.jobId})` : ''}`
  if (Array.isArray(result)) return `${result.length} lines`
  if (r.success) return `Updated`
  if (r.name) return `Loaded: ${r.name}`
  return 'OK'
}

function hasError(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  return !!(result as Record<string, unknown>).error
}

function formatError(result: unknown): string {
  if (!result || typeof result !== 'object') return 'Unknown error'
  return String((result as Record<string, unknown>).error || 'Error')
}
