import { initializeApp, cert, getApps, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { PriceList } from './types'
import { DEFAULT_SCREEN_PRINT_GRIDS, DEFAULT_EMBROIDERY_GRIDS, DEFAULT_PATCH_GRIDS, DEFAULT_MARGIN_TIERS, DEFAULT_MARKUPS } from './engine'

// ─── Firebase Admin (cg-dashboard-1b1d3) ────────────────────────────────────

let app: App

function getApp(): App {
  if (getApps().length > 0) return getApps()[0]
  app = initializeApp({
    credential: cert({
      projectId: process.env.GCP_PROJECT_ID!,
      clientEmail: process.env.GCP_CLIENT_EMAIL!,
      privateKey: process.env.GCP_PRIVATE_KEY!.replace(/\\n/g, '\n')
    })
  })
  return app
}

// ─── Firestore REST API (cg-pricing-calculator) ──────────────────────────────
// cgdecoration.netlify.app uses a client-side Firebase project (cg-pricing-calculator).
// We read from it via the REST API using the public web API key so that any changes
// made in cgdecoration are immediately reflected here — no static fallbacks.

const CG_PRICING_PROJECT = 'cg-pricing-calculator'
// Public web API key for cg-pricing-calculator (cgdecoration.netlify.app).
// This is a Firebase *web* API key — not a secret. It's safe to embed in code.
// Security is enforced by Firestore rules (priceLists: allow read: if true).
const CG_PRICING_API_KEY = process.env.CG_PRICING_FIREBASE_API_KEY ?? 'AIzaSyClU1aZ8Gx7kOkk5vm2zgM2hkZ0dqUPhtM'

/** Recursively convert a Firestore REST API value object to a plain JS value */
function fromFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return Number(val.integerValue)
  if ('doubleValue' in val) return val.doubleValue
  if ('nullValue' in val) return null
  if ('arrayValue' in val) {
    const arr = val.arrayValue as { values?: Record<string, unknown>[] }
    return (arr.values ?? []).map(v => fromFirestoreValue(v as Record<string, unknown>))
  }
  if ('mapValue' in val) {
    const map = val.mapValue as { fields?: Record<string, Record<string, unknown>> }
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(map.fields ?? {})) {
      result[k] = fromFirestoreValue(v)
    }
    return result
  }
  return undefined
}

function fromFirestoreDoc(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v)
  }
  return result
}

async function fetchFromCgPricingFirestore(): Promise<PriceList | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${CG_PRICING_PROJECT}/databases/(default)/documents:runQuery?key=${CG_PRICING_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'priceLists' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'active' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        },
        limit: 1
      }
    })
  })

  if (!res.ok) {
    console.error(`cg-pricing-calculator Firestore REST error: ${res.status}`)
    return null
  }

  const results = await res.json() as Array<{ document?: { name: string; fields: Record<string, Record<string, unknown>> } }>
  const doc = results[0]?.document
  if (!doc) return null

  const id = doc.name.split('/').pop() ?? 'unknown'
  return { id, ...fromFirestoreDoc(doc.fields) } as PriceList
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getActivePriceList(): Promise<PriceList> {
  // 1. Primary: read live price list from cg-pricing-calculator (cgdecoration.netlify.app)
  //    Changes made there are reflected immediately on every agent run.
  try {
    const pl = await fetchFromCgPricingFirestore()
    if (pl) return pl
  } catch (err) {
    console.error('cg-pricing-calculator fetch failed:', err)
  }

  // 2. Fallback: cg-dashboard-1b1d3 via Admin SDK
  try {
    const db = getFirestore(getApp())
    const snapshot = await db.collection('priceLists').where('active', '==', true).limit(1).get()
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() } as PriceList
    }
  } catch (err) {
    console.error('Firestore admin error:', err)
  }

  // 3. Last resort: hardcoded defaults
  console.warn('Using hardcoded default price list — no active Firestore price list found')
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
