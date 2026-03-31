export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getActivePriceList } from '@/lib/pricing/firebase'
import { DEFAULT_SCREEN_PRINT_GRIDS, DEFAULT_EMBROIDERY_GRIDS, DEFAULT_PATCH_GRIDS } from '@/lib/pricing/engine'

export async function GET() {
  try {
    const pl = await getActivePriceList()

    // Use optional chaining — if a grids array is undefined/null in the
    // Firestore document, fall back to the engine defaults rather than
    // throwing a TypeError that silently returns the 3-grid hardcoded list.
    const screenPrint = pl.screenPrintGrids?.map(g => g.name)
      ?? DEFAULT_SCREEN_PRINT_GRIDS.map(g => g.name)
    const embroidery = pl.embroideryGrids?.map(g => g.name)
      ?? DEFAULT_EMBROIDERY_GRIDS.map(g => g.name)
    const patch = pl.patchGrids?.map(g => g.name)
      ?? DEFAULT_PATCH_GRIDS.map(g => g.name)

    return NextResponse.json({
      screenPrint,
      embroidery,
      patch,
      _source: pl.id, // diagnostic: shows which price list was loaded
    })
  } catch (err) {
    console.error('decoration-grids: unexpected error', err)
    return NextResponse.json({
      screenPrint: DEFAULT_SCREEN_PRINT_GRIDS.map(g => g.name),
      embroidery: DEFAULT_EMBROIDERY_GRIDS.map(g => g.name),
      patch: DEFAULT_PATCH_GRIDS.map(g => g.name),
      _source: 'error-fallback',
    })
  }
}
