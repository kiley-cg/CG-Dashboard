import { registerTool } from '../registry'
import {
  getMarginForQuantity,
  getDecorationCost,
  applyMarkup,
  calculateSellingPrice,
  DEFAULT_MARGIN_TIERS,
  DEFAULT_SCREEN_PRINT_GRIDS,
  DEFAULT_EMBROIDERY_GRIDS,
  DEFAULT_PATCH_GRIDS,
  DEFAULT_MARKUPS,
} from '@/lib/pricing/engine'
import type { PricingGrid, MarginTier } from '@/lib/pricing/types'
import { getCachedPriceList } from './price-list-cache'

registerTool({
  name: 'calculate_price',
  description: `Calculate the all-in retail price for a SIZE line.

The price on a Size line = garment retail + sum of ALL decoration location retail prices.
Formula:
  garment_retail = vendorCost / (1 - margin%)
  decoration_retail = matrix_net × (1 + markup%)  [per location]
  size_line_price = garment_retail + decoration_1_retail + decoration_2_retail + ...

Pass vendor_cost and the full list of decorations. Returns the total per-unit price to set on the Size line.

ImprintLocation lines are SKIPPED — their decoration specs feed into this calculation but they don't get their own price.

Requires get_active_price_list to have been called first (loads data into cache automatically).`,
  inputSchema: {
    type: 'object',
    properties: {
      vendor_cost: { type: 'number', description: 'Net cost from vendor for this garment (may vary by size for oversized)' },
      quantity: { type: 'number', description: 'Total order quantity across all sizes (used for margin + decoration matrix lookup)' },
      decorations: {
        type: 'array',
        description: 'All decoration locations for this order',
        items: {
          type: 'object',
          properties: {
            decoration_type: { type: 'string', enum: ['screenPrint', 'embroidery', 'patch'], description: 'Technique' },
            row_key: { type: 'string', description: 'Number of colors (screen print/patch) or stitch count (embroidery)' },
            grid_name: { type: 'string', description: '"Darks", "Lights", "Specialty", "Standard", "Hats", or "Flats"' },
          },
          required: ['decoration_type', 'row_key', 'grid_name']
        }
      }
    },
    required: ['vendor_cost', 'quantity', 'decorations']
  },
  execute: async (rawInput) => {
    const input = rawInput as {
      vendor_cost: number
      quantity: number
      decorations: Array<{
        decoration_type: 'screenPrint' | 'embroidery' | 'patch'
        row_key: string
        grid_name: string
      }>
    }

    const pl = getCachedPriceList()
    const tiers: MarginTier[] = pl?.marginGrids?.[0]?.tiers ?? DEFAULT_MARGIN_TIERS
    const margin = getMarginForQuantity(input.quantity, tiers)
    const garmentRetail = Math.round(calculateSellingPrice(input.vendor_cost, margin) * 100) / 100

    const decoBreakdowns: string[] = []
    let totalDecoRetail = 0

    for (const deco of input.decorations) {
      let grids: PricingGrid[] = []
      let markup = DEFAULT_MARKUPS.screenPrint

      if (deco.decoration_type === 'screenPrint') {
        grids = pl?.screenPrintGrids ?? DEFAULT_SCREEN_PRINT_GRIDS
        markup = pl?.screenPrintMarkup ?? DEFAULT_MARKUPS.screenPrint
      } else if (deco.decoration_type === 'embroidery') {
        grids = pl?.embroideryGrids ?? DEFAULT_EMBROIDERY_GRIDS
        markup = pl?.embroideryMarkup ?? DEFAULT_MARKUPS.embroidery
      } else if (deco.decoration_type === 'patch') {
        grids = pl?.patchGrids ?? DEFAULT_PATCH_GRIDS
        markup = pl?.patchMarkup ?? DEFAULT_MARKUPS.patch
      }

      const grid = grids.find(g => g.name.toLowerCase() === deco.grid_name.toLowerCase()) ?? grids[0]
      if (!grid) {
        decoBreakdowns.push(`[no grid for ${deco.decoration_type}/${deco.grid_name}]`)
        continue
      }

      const net = getDecorationCost(grid.matrix, deco.row_key, input.quantity, grid.columns)
      const retail = Math.round(applyMarkup(net, markup) * 100) / 100
      totalDecoRetail += retail
      decoBreakdowns.push(`${grid.name} ${deco.row_key} colors: $${net.toFixed(2)} × ${100 + markup}% = $${retail.toFixed(2)}`)
    }

    const totalPrice = Math.round((garmentRetail + totalDecoRetail) * 100) / 100

    return {
      price: totalPrice,
      garment_retail: garmentRetail,
      total_deco_retail: Math.round(totalDecoRetail * 100) / 100,
      margin_percent: margin,
      breakdown: [
        `Garment: $${input.vendor_cost.toFixed(2)} ÷ (1-${margin}%) = $${garmentRetail.toFixed(2)}`,
        ...decoBreakdowns,
        `Total: $${totalPrice.toFixed(2)}`
      ].join(' | ')
    }
  }
})
