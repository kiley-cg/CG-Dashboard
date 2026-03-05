export interface MarginTier {
  minQty: number
  maxQty: number | null
  margin: number
}

export interface PricingGrid {
  id: string
  name: string
  rowLabelTitle: string
  rows: string[]
  columns: string[]
  matrix: Record<string, Record<string, number>>
}

export interface MarginGrid {
  id: string
  name: string
  tiers: MarginTier[]
}

export interface AdditionalService {
  id: string
  name: string
  category: string
  netPrice: number
  retailPrice: number
}

export interface PriceList {
  id: string
  name: string
  active: boolean
  screenPrintMarkup: number
  embroideryMarkup: number
  patchMarkup: number
  screenPrintGrids: PricingGrid[]
  embroideryGrids: PricingGrid[]
  patchGrids: PricingGrid[]
  marginGrids: MarginGrid[]
  additionalServices: AdditionalService[]
  enabledTechniques: string[]
  embroideryOveragePerThousand?: number
}
