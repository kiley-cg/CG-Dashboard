import { registerTool } from '../registry'
import {
  getMarginForQuantity,
  getDecorationCost,
  applyMarkup,
  calculateSellingPrice
} from '@/lib/pricing/engine'
import type { PriceList, PricingGrid, MarginTier } from '@/lib/pricing/types'

interface GarmentInput {
  line_type: 'garment'
  vendor_cost: number
  quantity: number
  price_list: PriceList
}

interface DecorationInput {
  line_type: 'decoration'
  quantity: number
  decoration_type: 'screenPrint' | 'embroidery' | 'patch'
  row_key: string
  grid_name?: string
  price_list: PriceList
}

type CalcInput = GarmentInput | DecorationInput

registerTool({
  name: 'calculate_price',
  description: `Calculate the expected customer price for a line item using the pricing matrices.

For garment lines: supply vendor_cost and quantity. Returns retail = vendorCost / (1 - margin%).
For decoration lines: supply decoration_type, row_key (number of colors or stitch count), grid_name (e.g. "Darks", "Lights", "Specialty" for screen print; "Standard" for embroidery), and quantity. Returns retail = matrix_net × (1 + markup%).

Always pass the full price_list object returned by get_active_price_list.`,
  inputSchema: {
    type: 'object',
    properties: {
      line_type: { type: 'string', enum: ['garment', 'decoration'], description: 'Type of line item' },
      vendor_cost: { type: 'number', description: 'Net cost from vendor (garment lines only)' },
      quantity: { type: 'number', description: 'Total order quantity (not per-size)' },
      decoration_type: { type: 'string', enum: ['screenPrint', 'embroidery', 'patch'], description: 'Decoration technique (decoration lines only)' },
      row_key: { type: 'string', description: 'Row identifier: number of colors (screen print/patch) or stitch count (embroidery)' },
      grid_name: { type: 'string', description: 'Grid name: "Darks", "Lights", or "Specialty" for screen print; "Standard" for embroidery; "Hats" or "Flats" for patch' },
      price_list: { type: 'object', description: 'The full price list from get_active_price_list' }
    },
    required: ['line_type', 'quantity', 'price_list']
  },
  execute: async (rawInput) => {
    const input = rawInput as CalcInput

    if (input.line_type === 'garment') {
      const tiers: MarginTier[] = input.price_list.marginGrids?.[0]?.tiers || []
      const margin = getMarginForQuantity(input.vendor_cost ? input.quantity : 0, tiers)
      const actualMargin = getMarginForQuantity(input.quantity, tiers)
      const price = Math.round(calculateSellingPrice(input.vendor_cost, actualMargin) * 100) / 100
      return {
        price,
        margin_percent: actualMargin,
        breakdown: `$${input.vendor_cost.toFixed(2)} vendor cost ÷ (1 - ${actualMargin}%) = $${price.toFixed(2)}`
      }
    }

    if (input.line_type === 'decoration') {
      const { decoration_type, row_key, grid_name, quantity, price_list } = input as DecorationInput

      let grids: PricingGrid[] = []
      let markup = 40
      if (decoration_type === 'screenPrint') {
        grids = price_list.screenPrintGrids || []
        markup = price_list.screenPrintMarkup ?? 40
      } else if (decoration_type === 'embroidery') {
        grids = price_list.embroideryGrids || []
        markup = price_list.embroideryMarkup ?? 30
      } else if (decoration_type === 'patch') {
        grids = price_list.patchGrids || []
        markup = price_list.patchMarkup ?? 30
      }

      const grid = grid_name
        ? grids.find(g => g.name.toLowerCase() === grid_name.toLowerCase()) || grids[0]
        : grids[0]

      if (!grid) return { error: `No grid found for ${decoration_type} / ${grid_name}` }

      const net = getDecorationCost(grid.matrix, row_key, quantity, grid.columns)
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
