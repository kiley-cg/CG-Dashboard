import { initializeApp, cert, getApps, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { PriceList } from './types'
import { DEFAULT_SCREEN_PRINT_GRIDS, DEFAULT_EMBROIDERY_GRIDS, DEFAULT_PATCH_GRIDS, DEFAULT_MARGIN_TIERS, DEFAULT_MARKUPS } from './engine'

let app: App

function getApp(): App {
  if (getApps().length > 0) return getApps()[0]
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
    })
  })
  return app
}

export async function getActivePriceList(): Promise<PriceList> {
  try {
    const db = getFirestore(getApp())
    const snapshot = await db.collection('priceLists').where('active', '==', true).limit(1).get()
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() } as PriceList
    }
  } catch (err) {
    console.error('Firestore error, using defaults:', err)
  }

  // Fallback to default price list
  return {
    id: 'default',
    name: 'Default (Frontier)',
    active: true,
    screenPrintMarkup: DEFAULT_MARKUPS.screenPrint,
    embroideryMarkup: DEFAULT_MARKUPS.embroidery,
    patchMarkup: DEFAULT_MARKUPS.patch,
    screenPrintGrids: DEFAULT_SCREEN_PRINT_GRIDS,
    embroideryGrids: DEFAULT_EMBROIDERY_GRIDS,
    patchGrids: DEFAULT_PATCH_GRIDS,
    marginGrids: [{ id: 'margin-default', name: 'Default', tiers: DEFAULT_MARGIN_TIERS }],
    additionalServices: [],
    enabledTechniques: ['screenPrint', 'embroidery', 'patch']
  }
}
