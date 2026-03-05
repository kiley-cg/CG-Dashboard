'use client'

import type { PricingProposalLine } from '@/lib/agent/types'

interface PricingProposalProps {
  lines: PricingProposalLine[]
  onApply: () => void
  onCancel: () => void
  isApplying: boolean
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  garment: { label: 'Garment', color: 'bg-blue-100 text-blue-700' },
  decoration: { label: 'Decoration', color: 'bg-purple-100 text-purple-700' },
  service: { label: 'Service', color: 'bg-orange-100 text-orange-700' },
  unclassified: { label: 'Unknown', color: 'bg-gray-100 text-gray-600' }
}

export function PricingProposal({ lines, onApply, onCancel, isApplying }: PricingProposalProps) {
  const applicable = lines.filter(l => !l.skip)
  const skipped = lines.filter(l => l.skip)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Pricing Proposal</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {applicable.length} line{applicable.length !== 1 ? 's' : ''} to price
            {skipped.length > 0 && `, ${skipped.length} skipped`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={isApplying || applicable.length === 0}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isApplying ? 'Applying...' : `Apply ${applicable.length} Price${applicable.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-600 w-12">#</th>
              <th className="px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Vendor Cost</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Margin/Markup</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Price</th>
              <th className="px-4 py-3 font-medium text-gray-600">Breakdown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map((line, i) => {
              const badge = TYPE_BADGE[line.lineType] || TYPE_BADGE.unclassified
              return (
                <tr
                  key={line.lineId}
                  className={`hover:bg-gray-50 transition-colors ${line.skip ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${badge.color} shrink-0`}>
                        {badge.label}
                      </span>
                      <div>
                        <div className="text-gray-900 font-medium">
                          {line.description || line.sku || `Line ${line.lineId}`}
                        </div>
                        {line.sku && line.description && (
                          <div className="text-gray-400 text-xs mt-0.5">{line.sku}</div>
                        )}
                        {line.skip && (
                          <div className="text-amber-600 text-xs mt-1">{line.skipReason}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{line.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {line.vendorCost !== undefined ? `$${line.vendorCost.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {line.marginPercent !== undefined
                      ? `${line.marginPercent}% margin`
                      : line.markupPercent !== undefined
                      ? `${line.markupPercent}% markup`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {line.skip ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className="font-semibold text-gray-900">
                        ${line.calculatedPrice.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                    {line.breakdown}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
