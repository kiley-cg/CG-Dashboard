import { NextResponse } from 'next/server'
import { getActivePriceList } from '@/lib/pricing/firebase'

export async function GET() {
  try {
    const pl = await getActivePriceList()
    return NextResponse.json({
      screenPrint: pl.screenPrintGrids.map(g => g.name),
      embroidery: pl.embroideryGrids.map(g => g.name),
      patch: pl.patchGrids.map(g => g.name),
    })
  } catch {
    return NextResponse.json({
      screenPrint: ['Darks', 'Lights', 'Specialty'],
      embroidery: ['Standard'],
      patch: ['Hats', 'Flats'],
    })
  }
}
