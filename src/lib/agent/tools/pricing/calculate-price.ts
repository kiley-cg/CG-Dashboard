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
  description: `Calculate the customer price for a line item using the active pricing matrices.

For garment lines: supply vendor_cost and quantity. Returns retail = vendorCost / (1 - margin%).
For decoration lines: supply decoration_type, row_key (number of colors or stitch count), grid_name (e.g. "Darks", "Lights", "Specialty" for screen print; "Standard" for embroidery; "Hats" or "Flats" for patch), and quantity. Returns retail = matrix_net × (1 + markup%).

Requires get_active_price_list to have been called first (loads data into cache automatically).`,
  inputSchema: {
    type: 'object',
    properties: {
      line_type: { type: 'string', enum: ['garment', 'decoration'], description: 'Type of line item' },
      vendor_cost: { type: 'number', description: 'Net cost from vendor (garment lines only)' },
      quantity: { type: 'number', description: 'Total order quantity (not per-size)' },
      decoration_type: { type: 'string', enum: ['screenPrint', 'embroidery', 'patch'], description: 'Decoration technique (decoration lines only)' },
      row_key: { type: 'string', description: 'Row identifier: number of colors (screen print/patch) or stitch count (embroidery)' },
      grid_name: { type: 'string', description: 'Grid name: "Darks", "Lights", or "Specialty" for screen print; "Standard" for embroidery; "Hats" or "Flats" for patch' },
    },
    required: ['line_type', 'quantity']
  },
  execute: async (rawInput) => {
    const input = rawInput as {
      line_type: 'garment' | 'decoration'
      vendor_cost?: number
      quantity: number
      decoration_type?: 'screenPrint' | 'embroidery' | 'patch'
      row_key?: string
      grid_name?: string
    }

    const pl = getCachedPriceList()

    if (input.line_type === 'garment') {
      const tiers: MarginTier[] = pl?.marginGrids?.[0]?.tiers ?? DEFAULT_MARGIN_TIERS
      const margin = getMarginForQuantity(input.quantity, tiers)
      const cost = input.vendor_cost ?? 0
      const price = Math.round(calculateSellingPrice(cost, margin) * 100) / 100
      return {
        price,
        margin_percent: margin,
        breakdown: `$${cost.toFixed(2)} vendor cost ÷ (1 - ${margin}%) = $${price.toFixed(2)}`
      }
    }

    if (input.line_type === 'decoration') {
      const { decoration_type, row_key, grid_name, quantity } = input

      let grids: PricingGrid[] = []
      let markup = DEFAULT_MARKUPS.screenPrint

      if (decoration_type === 'screenPrint') {
        grids = pl?.screenPrintGrids ?? DEFAULT_SCREEN_PRINT_GRIDS
        markup = pl?.screenPrintMarkup ?? DEFAULT_MARKUPS.screenPrint
      } else if (decoration_type === 'embroidery') {
        grids = pl?.embroideryGrids ?? DEFAULT_EMBROIDERY_GRIDS
        markup = pl?.embroideryMarkup ?? DEFAULT_MARKUPS.embroidery
      } else if (decoration_type === 'patch') {
        grids = pl?.patchGrids ?? DEFAULT_PATCH_GRIDS
        markup = pl?.patchMarkup ?? DEFAULT_MARKUPS.patch
      }

      const grid = grid_name
        ? grids.find(g => g.name.toLowerCase() === grid_name.toLowerCase()) ?? grids[0]
        : grids[0]

      if (!grid) return { error: `No grid found for ${decoration_type} / ${grid_name}` }

      const net = getDecorationCost(grid.matrix, row_key ?? '1', quantity, grid.columns)
      if (net === 0) return { error: `No price found in matrix for row_key="${row_key}" at qty ${quantity}` }

      const price = Math.round(applyMarkup(net, markup) * 100) / 100
      return {
        price,
        net_cost: net,
        markup_percent: markup,
        grid_used: grid.name,
        breakdown: `$${net.toFixed(2)} net (${grid.name} matrix, ${row_key} row, qty ${quantity}) × ${100 + markup}% = $${price.toFixed(2)}`
      }
    }

    return { error: 'Unknown line_type' }
  }
})
