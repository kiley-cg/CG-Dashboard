'use client'

import { useState, FormEvent } from 'react'

interface OrderLookupProps {
  onSubmit: (orderNumber: string) => void
  isLoading: boolean
}

export function OrderLookup({ onSubmit, isLoading }: OrderLookupProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="flex-1">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter Sales Order ID or Job ID..."
          disabled={isLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Working...
          </span>
        ) : (
          'Price Order'
        )}
      </button>
    </form>
  )
}
