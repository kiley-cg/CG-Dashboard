'use client'

import { useState, useCallback } from 'react'
import { OrderLookup } from './OrderLookup'
import type { OrderLookupValues } from './OrderLookup'
import { AgentThinking } from './AgentThinking'
import { PricingProposal } from './PricingProposal'
import { PricingChat } from './PricingChat'
import type { AgentEvent, PricingProposalLine } from '@/lib/agent/types'

type Phase = 'idle' | 'proposing' | 'proposal_ready' | 'applying' | 'done' | 'error'

export function PricingTool() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [proposal, setProposal] = useState<PricingProposalLine[] | null>(null)
  const [currentOrder, setCurrentOrder] = useState<string>('')
  const [currentLookup, setCurrentLookup] = useState<OrderLookupValues | null>(null)
  const [summary, setSummary] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const appendEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [...prev, event])
  }, [])

  async function runAgent(lookup: OrderLookupValues, mode: 'propose' | 'apply', proposalData?: PricingProposalLine[]) {
    const body = {
      task: 'pricing',
      mode,
      input: {
        orderNumber: lookup.orderNumber,
        decorator: lookup.decorator,
        decorationType: lookup.decorationType || undefined,
        gridName: lookup.gridName || undefined,
        proposal: proposalData
      }
    }

    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok || !res.body) {
      throw new Error(`API error: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event: AgentEvent = JSON.parse(line.slice(6))
          appendEvent(event)

          if (event.type === 'proposal') {
            setProposal(event.lines)
            setPhase('proposal_ready')
          } else if (event.type === 'complete') {
            setSummary(event.summary)
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) continue
          throw parseErr
        }
      }
    }
  }

  async function handleSubmit(values: OrderLookupValues) {
    setCurrentOrder(values.orderNumber)
    setCurrentLookup(values)
    setPhase('proposing')
    setEvents([])
    setProposal(null)
    setSummary('')
    setErrorMsg('')

    try {
      await runAgent(values, 'propose')
      setPhase(prev => prev === 'proposing' ? 'done' : prev)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  async function handleApply() {
    if (!proposal || !currentLookup) return
    setPhase('applying')
    setEvents(prev => [...prev, { type: 'reasoning', text: '\n--- Applying approved pricing ---\n' }])

    try {
      await runAgent(currentLookup, 'apply', proposal)
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  function handleCancel() {
    setPhase('idle')
    setProposal(null)
    setEvents([])
    setSummary('')
  }

  function handleReset() {
    setPhase('idle')
    setProposal(null)
    setEvents([])
    setSummary('')
    setCurrentOrder('')
    setCurrentLookup(null)
    setErrorMsg('')
  }

  const isRunning = phase === 'proposing' || phase === 'applying'
  const isApplying = phase === 'applying'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Pricing Agent</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Enter a Sales Order or Job ID — the agent will read the order, calculate correct pricing, and write it into Syncore.
        </p>
      </div>

      {/* Input */}
      <OrderLookup onSubmit={handleSubmit} isLoading={isRunning} />

      {/* Error state */}
      {phase === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-red-800">Something went wrong</div>
            <div className="text-red-600 text-sm mt-1">{errorMsg}</div>
          </div>
          <button onClick={handleReset} className="text-red-600 hover:text-red-800 text-sm underline shrink-0">
            Try again
          </button>
        </div>
      )}

      {/* Agent reasoning */}
      {events.length > 0 && (
        <AgentThinking events={events} isRunning={isRunning} />
      )}

      {/* Pricing proposal */}
      {proposal && (phase === 'proposal_ready' || phase === 'applying' || phase === 'done') && (
        <PricingProposal
          lines={proposal}
          onApply={handleApply}
          onCancel={handleCancel}
          isApplying={isApplying}
        />
      )}

      {/* Refinement chat — visible once a proposal exists */}
      {proposal && phase !== 'idle' && phase !== 'proposing' && (
        <PricingChat
          orderNumber={currentOrder}
          decorator={currentLookup?.decorator}
          currentProposal={proposal}
          onProposalUpdate={setProposal}
        />
      )}

      {/* Done state */}
      {phase === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-green-800">Pricing applied successfully</div>
            {summary && (
              <div className="text-green-700 text-sm mt-1 whitespace-pre-wrap">{summary}</div>
            )}
          </div>
          <button
            onClick={handleReset}
            className="text-green-700 hover:text-green-900 text-sm border border-green-300 px-3 py-1.5 rounded-lg shrink-0"
          >
            Price another order
          </button>
        </div>
      )}
    </div>
  )
}
