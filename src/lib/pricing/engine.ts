import type { MarginTier, PricingGrid, PriceList } from './types'

export const QUANTITY_BRACKETS = [6, 12, 24, 36, 48, 72, 144, 288, 500, 1000, 2000]

export const DEFAULT_SCREEN_PRINT_DARKS: Record<string, Record<string, number>> = {
  "1": { "6": 2.10, "12": 1.80, "24": 1.55, "36": 1.40, "48": 1.30, "72": 1.20, "144": 1.05, "288": 0.90, "500": 0.75, "1000": 0.65, "2000": 0.55 },
  "2": { "6": 2.50, "12": 2.10, "24": 1.80, "36": 1.60, "48": 1.50, "72": 1.40, "144": 1.20, "288": 1.05, "500": 0.90, "1000": 0.80, "2000": 0.70 },
  "3": { "6": 2.90, "12": 2.40, "24": 2.05, "36": 1.80, "48": 1.70, "72": 1.55, "144": 1.35, "288": 1.20, "500": 1.05, "1000": 0.95, "2000": 0.85 },
  "4": { "6": 3.30, "12": 2.70, "24": 2.30, "36": 2.00, "48": 1.90, "72": 1.75, "144": 1.50, "288": 1.35, "500": 1.20, "1000": 1.10, "2000": 1.00 },
  "5": { "6": 3.70, "12": 3.00, "24": 2.55, "36": 2.20, "48": 2.10, "72": 1.90, "144": 1.65, "288": 1.50, "500": 1.35, "1000": 1.25, "2000": 1.15 },
  "6": { "6": 4.10, "12": 3.30, "24": 2.80, "36": 2.40, "48": 2.30, "72": 2.10, "144": 1.80, "288": 1.65, "500": 1.50, "1000": 1.40, "2000": 1.30 }
}

export const DEFAULT_SCREEN_PRINT_LIGHTS: Record<string, Record<string, number>> = {
  "1": { "6": 1.80, "12": 1.55, "24": 1.30, "36": 1.15, "48": 1.05, "72": 0.95, "144": 0.85, "288": 0.70, "500": 0.60, "1000": 0.50, "2000": 0.45 },
  "2": { "6": 2.10, "12": 1.80, "24": 1.55, "36": 1.35, "48": 1.25, "72": 1.15, "144": 1.00, "288": 0.85, "500": 0.75, "1000": 0.65, "2000": 0.60 },
  "3": { "6": 2.40, "12": 2.05, "24": 1.80, "36": 1.55, "48": 1.45, "72": 1.30, "144": 1.15, "288": 1.00, "500": 0.90, "1000": 0.80, "2000": 0.75 },
  "4": { "6": 2.70, "12": 2.30, "24": 2.05, "36": 1.75, "48": 1.65, "72": 1.50, "144": 1.30, "288": 1.15, "500": 1.05, "1000": 0.95, "2000": 0.90 },
  "5": { "6": 3.00, "12": 2.55, "24": 2.30, "36": 1.95, "48": 1.85, "72": 1.65, "144": 1.45, "288": 1.30, "500": 1.20, "1000": 1.10, "2000": 1.05 },
  "6": { "6": 3.30, "12": 2.80, "24": 2.55, "36": 2.15, "48": 2.05, "72": 1.85, "144": 1.60, "288": 1.45, "500": 1.35, "1000": 1.25, "2000": 1.20 }
}

export const DEFAULT_SCREEN_PRINT_SPECIALTY: Record<string, Record<string, number>> = {
  "1": { "6": 2.60, "12": 2.30, "24": 2.05, "36": 1.90, "48": 1.80, "72": 1.70, "144": 1.55, "288": 1.40, "500": 1.25, "1000": 1.15, "2000": 1.05 },
  "2": { "6": 3.00, "12": 2.60, "24": 2.30, "36": 2.10, "48": 2.00, "72": 1.90, "144": 1.70, "288": 1.55, "500": 1.40, "1000": 1.30, "2000": 1.20 },
  "3": { "6": 3.40, "12": 2.90, "24": 2.55, "36": 2.30, "48": 2.20, "72": 2.05, "144": 1.85, "288": 1.70, "500": 1.55, "1000": 1.45, "2000": 1.35 },
  "4": { "6": 3.80, "12": 3.20, "24": 2.80, "36": 2.50, "48": 2.40, "72": 2.25, "144": 2.00, "288": 1.85, "500": 1.70, "1000": 1.60, "2000": 1.50 },
  "5": { "6": 4.20, "12": 3.50, "24": 3.05, "36": 2.70, "48": 2.60, "72": 2.40, "144": 2.15, "288": 2.00, "500": 1.85, "1000": 1.75, "2000": 1.65 },
  "6": { "6": 4.60, "12": 3.80, "24": 3.30, "36": 2.90, "48": 2.80, "72": 2.60, "144": 2.30, "288": 2.15, "500": 2.00, "1000": 1.90, "2000": 1.80 }
}

export const DEFAULT_EMBROIDERY_MATRIX: Record<string, Record<string, number>> = {
  "4000": { "6": 5.00, "12": 4.50, "24": 4.00, "36": 3.75, "48": 3.50, "72": 3.25, "144": 3.00, "288": 2.75, "500": 2.50, "1000": 2.25 },
  "5000": { "6": 5.25, "12": 4.75, "24": 4.25, "36": 4.00, "48": 3.75, "72": 3.50, "144": 3.25, "288": 3.00, "500": 2.75, "1000": 2.50 },
  "6000": { "6": 5.50, "12": 5.00, "24": 4.50, "36": 4.25, "48": 4.00, "72": 3.75, "144": 3.50, "288": 3.25, "500": 3.00, "1000": 2.75 },
  "7000": { "6": 5.75, "12": 5.25, "24": 4.75, "36": 4.50, "48": 4.25, "72": 4.00, "144": 3.75, "288": 3.50, "500": 3.25, "1000": 3.00 },
  "8000": { "6": 6.00, "12": 5.50, "24": 5.00, "36": 4.75, "48": 4.50, "72": 4.25, "144": 4.00, "288": 3.75, "500": 3.50, "1000": 3.25 },
  "9000": { "6": 6.25, "12": 5.75, "24": 5.25, "36": 5.00, "48": 4.75, "72": 4.50, "144": 4.25, "288": 4.00, "500": 3.75, "1000": 3.50 },
  "10000": { "6": 6.50, "12": 6.00, "24": 5.50, "36": 5.25, "48": 5.00, "72": 4.75, "144": 4.50, "288": 4.25, "500": 4.00, "1000": 3.75 },
  "11000": { "6": 6.75, "12": 6.25, "24": 5.75, "36": 5.50, "48": 5.25, "72": 5.00, "144": 4.75, "288": 4.50, "500": 4.25, "1000": 4.00 },
  "12000": { "6": 7.00, "12": 6.50, "24": 6.00, "36": 5.75, "48": 5.50, "72": 5.25, "144": 5.00, "288": 4.75, "500": 4.50, "1000": 4.25 },
  "13000": { "6": 7.25, "12": 6.75, "24": 6.25, "36": 6.00, "48": 5.75, "72": 5.50, "144": 5.25, "288": 5.00, "500": 4.75, "1000": 4.50 },
  "14000": { "6": 7.50, "12": 7.00, "24": 6.50, "36": 6.25, "48": 6.00, "72": 5.75, "144": 5.50, "288": 5.25, "500": 5.00, "1000": 4.75 },
  "15000": { "6": 7.75, "12": 7.25, "24": 6.75, "36": 6.50, "48": 6.25, "72": 6.00, "144": 5.75, "288": 5.50, "500": 5.25, "1000": 5.00 }
}

export const DEFAULT_PATCH_HATS: Record<string, Record<string, number>> = {
  "1": { "6": 4.00, "12": 3.50, "24": 3.00, "36": 2.75, "48": 2.50, "72": 2.25, "144": 2.00, "288": 1.75, "500": 1.50, "1000": 1.25 },
  "2": { "6": 5.00, "12": 4.50, "24": 4.00, "36": 3.75, "48": 3.50, "72": 3.25, "144": 3.00, "288": 2.75, "500": 2.50, "1000": 2.25 }
}

export const DEFAULT_PATCH_FLATS: Record<string, Record<string, number>> = {
  "1": { "6": 3.00, "12": 2.50, "24": 2.00, "36": 1.75, "48": 1.50, "72": 1.25, "144": 1.00, "288": 0.85, "500": 0.70, "1000": 0.55 },
  "2": { "6": 4.00, "12": 3.50, "24": 3.00, "36": 2.75, "48": 2.50, "72": 2.25, "144": 2.00, "288": 1.75, "500": 1.50, "1000": 1.25 }
}

export const DEFAULT_MARGIN_TIERS: MarginTier[] = [
  { minQty: 2, maxQty: 5, margin: 50 },
  { minQty: 6, maxQty: 11, margin: 48 },
  { minQty: 12, maxQty: 23, margin: 45 },
  { minQty: 24, maxQty: 35, margin: 43 },
  { minQty: 36, maxQty: 47, margin: 41 },
  { minQty: 48, maxQty: 71, margin: 39 },
  { minQty: 72, maxQty: 143, margin: 37 },
  { minQty: 144, maxQty: 287, margin: 35 },
  { minQty: 288, maxQty: 499, margin: 33 },
  { minQty: 500, maxQty: 999, margin: 32 },
  { minQty: 1000, maxQty: 1999, margin: 31 },
  { minQty: 2000, maxQty: null, margin: 31 }
]

export const DEFAULT_MARKUPS = {
  screenPrint: 40,
  embroidery: 30,
  patch: 30
}

export const DEFAULT_SCREEN_PRINT_GRIDS: PricingGrid[] = [
  { id: 'sp-darks', name: 'Darks', rowLabelTitle: 'Colors', rows: ['1','2','3','4','5','6'], columns: QUANTITY_BRACKETS.map(String), matrix: DEFAULT_SCREEN_PRINT_DARKS },
  { id: 'sp-lights', name: 'Lights', rowLabelTitle: 'Colors', rows: ['1','2','3','4','5','6'], columns: QUANTITY_BRACKETS.map(String), matrix: DEFAULT_SCREEN_PRINT_LIGHTS },
  { id: 'sp-specialty', name: 'Specialty', rowLabelTitle: 'Colors', rows: ['1','2','3','4','5','6'], columns: QUANTITY_BRACKETS.map(String), matrix: DEFAULT_SCREEN_PRINT_SPECIALTY }
]

export const DEFAULT_EMBROIDERY_GRIDS: PricingGrid[] = [
  { id: 'emb-standard', name: 'Standard', rowLabelTitle: 'Stitches', rows: ['4000','5000','6000','7000','8000','9000','10000','11000','12000','13000','14000','15000'], columns: ['6','12','24','36','48','72','144','288','500','1000'], matrix: DEFAULT_EMBROIDERY_MATRIX }
]

export const DEFAULT_PATCH_GRIDS: PricingGrid[] = [
  { id: 'patch-hats', name: 'Hats', rowLabelTitle: '# Patches', rows: ['1','2'], columns: ['6','12','24','36','48','72','144','288','500','1000'], matrix: DEFAULT_PATCH_HATS },
  { id: 'patch-flats', name: 'Flats', rowLabelTitle: '# Patches', rows: ['1','2'], columns: ['6','12','24','36','48','72','144','288','500','1000'], matrix: DEFAULT_PATCH_FLATS }
]

export function getClosestQuantityBracket(qty: number): string {
  const numQty = Math.floor(qty) || 0
  for (let i = QUANTITY_BRACKETS.length - 1; i >= 0; i--) {
    if (numQty >= QUANTITY_BRACKETS[i]) return QUANTITY_BRACKETS[i].toString()
  }
  return QUANTITY_BRACKETS[0].toString()
}

export function getClosestQtyBracketFromColumns(qty: number, columns: string[]): string {
  const numQty = Math.floor(qty) || 0
  const sortedCols = [...columns].map(Number).sort((a, b) => a - b)
  let bracket = sortedCols[0]
  for (const col of sortedCols) {
    if (numQty >= col) bracket = col
  }
  return bracket.toString()
}

export function getMarginForQuantity(qty: number, marginTiers: MarginTier[] = DEFAULT_MARGIN_TIERS): number {
  const numQty = Math.floor(qty) || 0
  const tiers = marginTiers || DEFAULT_MARGIN_TIERS
  for (const tier of tiers) {
    const max = (tier.maxQty === null || tier.maxQty === undefined) ? Infinity : tier.maxQty
    if (numQty >= tier.minQty && numQty <= max) return tier.margin
  }
  return tiers[tiers.length - 1]?.margin || 0
}

export function getDecorationCost(
  matrix: Record<string, Record<string, number>>,
  rowKey: string,
  quantity: number,
  columns: string[]
): number {
  if (!matrix) return 0
  const cols = columns || QUANTITY_BRACKETS.map(String)
  const qtyBracket = getClosestQtyBracketFromColumns(quantity, cols)

  // Exact match first
  if (matrix[rowKey]?.[qtyBracket] !== undefined) return matrix[rowKey][qtyBracket]

  // If rowKey is numeric, snap up to the nearest row >= the given value
  const numKey = Number(rowKey)
  if (!isNaN(numKey)) {
    const sortedRows = Object.keys(matrix).map(Number).sort((a, b) => a - b)
    const snapped = sortedRows.find(r => r >= numKey)
    if (snapped !== undefined) return matrix[String(snapped)]?.[qtyBracket] ?? 0
    // If value exceeds all rows, use the highest row
    const highest = sortedRows[sortedRows.length - 1]
    return matrix[String(highest)]?.[qtyBracket] ?? 0
  }

  return 0
}

export function applyMarkup(netPrice: number, markupPercent: number): number {
  return netPrice * (1 + markupPercent / 100)
}

export function calculateSellingPrice(cost: number, marginPercent: number): number {
  if (marginPercent >= 100) return cost * 2
  return cost / (1 - marginPercent / 100)
}

export function normalizePriceList(pl: PriceList): PriceList {
  return {
    ...pl,
    marginGrids: (pl.marginGrids || []).map(g => ({
      ...g,
      tiers: g.tiers.map(t => ({
        ...t,
        maxQty: (t.maxQty === null || t.maxQty === undefined) ? null : t.maxQty
      }))
    }))
  }
}
