'use client'

import { useState, FormEvent } from 'react'

export interface OrderLookupValues {
  orderNumber: string
  decorator: string
  decorationType: 'screenPrint' | 'embroidery' | 'patch' | ''
  gridName: string
}

interface OrderLookupProps {
  onSubmit: (values: OrderLookupValues) => void
  isLoading: boolean
}

const DECORATION_TYPES = [
  { value: 'screenPrint', label: 'Screen Print' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'patch', label: 'Patch' },
] as const

const GRID_NAMES: Record<string, { value: string; label: string }[]> = {
  screenPrint: [
    { value: 'Darks', label: 'Darks' },
    { value: 'Lights', label: 'Lights' },
    { value: 'Specialty', label: 'Specialty' },
  ],
  embroidery: [
    { value: 'Standard', label: 'Standard' },
  ],
  patch: [
    { value: 'Hats', label: 'Hats' },
    { value: 'Flats', label: 'Flats' },
  ],
}

export function OrderLookup({ onSubmit, isLoading }: OrderLookupProps) {
  const [orderNumber, setOrderNumber] = useState('')
  const [decorator, setDecorator] = useState('')
  const [decorationType, setDecorationType] = useState<OrderLookupValues['decorationType']>('')
  const [gridName, setGridName] = useState('')

  const grids = decorationType ? GRID_NAMES[decorationType] ?? [] : []

  function handleDecorationTypeChange(val: OrderLookupValues['decorationType']) {
    setDecorationType(val)
    setGridName('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = orderNumber.trim()
    if (!trimmed || !decorator.trim() || !decorationType) return
    onSubmit({ orderNumber: trimmed, decorator: decorator.trim(), decorationType, gridName })
  }

  const canSubmit = orderNumber.trim() && decorator.trim() && decorationType

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Order number */}
      <input
        type="text"
        value={orderNumber}
        onChange={e => setOrderNumber(e.target.value)}
        placeholder="Enter Sales Order ID or Job ID..."
        disabled={isLoading}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        autoFocus
      />

      {/* Decorator + decoration type row */}
      <div className="flex gap-3">
        <input
          type="text"
          value={decorator}
          onChange={e => setDecorator(e.target.value)}
          placeholder="Decorator (e.g. InkWave, SanMar Embroidery…)"
          disabled={isLoading}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        />

        <select
          value={decorationType}
          onChange={e => handleDecorationTypeChange(e.target.value as OrderLookupValues['decorationType'])}
          disabled={isLoading}
          className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-colors bg-white"
        >
          <option value="">Decoration type…</option>
          {DECORATION_TYPES.map(dt => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>

        {grids.length > 1 && (
          <select
            value={gridName}
            onChange={e => setGridName(e.target.value)}
            disabled={isLoading}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-colors bg-white"
          >
            <option value="">Grid…</option>
            {grids.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Working…
          </span>
        ) : (
          'Price Order'
        )}
      </button>
    </form>
  )
}
