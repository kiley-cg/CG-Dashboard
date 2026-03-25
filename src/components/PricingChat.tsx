'use client'

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, PricingProposalLine } from '@/lib/agent/types'

interface PricingChatProps {
  orderNumber: string
  decorator?: string
  currentProposal: PricingProposalLine[] | null
  onProposalUpdate: (lines: PricingProposalLine[]) => void
}

export function PricingChat({
  orderNumber,
  decorator,
  currentProposal,
  onProposalUpdate,
}: PricingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function send() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'pricing',
          mode: 'chat',
          input: {
            orderNumber,
            decorator,
            messages: messages, // history before this turn (not including new user msg)
            chatMessage: text,
            currentProposal,
          },
        }),
      })

      if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let updatedProposal: PricingProposalLine[] | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'reasoning' && event.text) {
              fullText += event.text
              setStreamingText(fullText)
            } else if (event.type === 'complete' && event.summary) {
              if (!fullText) {
                fullText = event.summary
                setStreamingText(fullText)
              }
            } else if (event.type === 'proposal') {
              updatedProposal = event.lines
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      // Commit streaming text as assistant message
      const assistantMsg: ChatMessage = { role: 'assistant', content: fullText || '(no response)' }
      setMessages(prev => [...prev, assistantMsg])

      if (updatedProposal) {
        onProposalUpdate(updatedProposal)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${errMsg}` },
      ])
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    // Auto-grow textarea
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const allMessages = isStreaming
    ? [...messages, { role: 'assistant' as const, content: streamingText }]
    : messages

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">Refine Pricing</span>
        <span className="text-xs text-gray-400 ml-auto">Ask questions or request changes — the agent will update the proposal above</span>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto max-h-80 min-h-[80px]">
        {allMessages.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">
            Ask why a price was set, or say things like &ldquo;use Lights matrix&rdquo; or &ldquo;recalculate with 150 units&rdquo;
          </div>
        )}
        {allMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              } ${isStreaming && i === allMessages.length - 1 && msg.role === 'assistant' ? 'animate-pulse' : ''}`}
            >
              {msg.content || (isStreaming ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 overflow-hidden"
          style={{ minHeight: '40px', maxHeight: '160px' }}
        />
        <button
          onClick={send}
          disabled={isStreaming || !input.trim()}
          className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {isStreaming ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
