export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

const CG_PRICING_PROJECT = 'cg-pricing-calculator'
const CG_PRICING_API_KEY = process.env.CG_PRICING_FIREBASE_API_KEY ?? 'AIzaSyClU1aZ8Gx7kOkk5vm2zgM2hkZ0dqUPhtM'

/**
 * Diagnostic endpoint — returns info about the active price list and which
 * data source succeeded. Protected by the extension API key.
 *
 * GET /api/debug/price-list
 * Header: x-extension-api-key: <your key>
 */
export async function GET(req: Request) {
  const apiKey = req.headers.get('x-extension-api-key')
  if (apiKey !== process.env.EXTENSION_API_KEY) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      CG_PRICING_FIREBASE_API_KEY: process.env.CG_PRICING_FIREBASE_API_KEY ? 'set' : 'not set (using hardcoded)',
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID ? 'set' : 'not set',
      GCP_CLIENT_EMAIL: process.env.GCP_CLIENT_EMAIL ? 'set' : 'not set',
      GCP_PRIVATE_KEY: process.env.GCP_PRIVATE_KEY ? 'set' : 'not set',
      SS_CUSTOMER_NUMBER: process.env.SS_CUSTOMER_NUMBER ? 'set' : 'NOT SET — S&S will return null',
      SS_API_KEY: process.env.SS_API_KEY ? 'set' : 'not set',
    }
  }

  // --- Test 1: Firestore REST API (cg-pricing-calculator) ---
  try {
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

    result.firestoreRest = {
      status: res.status,
      ok: res.ok,
    }

    if (res.ok) {
      const data = await res.json() as Array<{ document?: { name: string; fields: Record<string, unknown> } }>
      const doc = data[0]?.document
      if (doc) {
        const fields = doc.fields as Record<string, unknown>
        const rawGrids = (fields.screenPrintGrids as { arrayValue?: { values?: Array<{ mapValue?: { fields?: Record<string, unknown> } }> } })?.arrayValue?.values ?? []
        result.firestoreRest = {
          ...result.firestoreRest as object,
          documentFound: true,
          documentId: doc.name.split('/').pop(),
          documentFields: Object.keys(fields),
          screenPrintGridCount: rawGrids.length,
          screenPrintGridNames: rawGrids.map((v) => {
            const nameField = v?.mapValue?.fields?.name as { stringValue?: string } | undefined
            return nameField?.stringValue ?? '(no name)'
          }),
        }
      } else {
        result.firestoreRest = {
          ...result.firestoreRest as object,
          documentFound: false,
          note: 'Query returned no results — no active price list in cg-pricing-calculator',
        }
      }
    } else {
      const text = await res.text().catch(() => '')
      result.firestoreRest = {
        ...result.firestoreRest as object,
        error: text.slice(0, 500),
      }
    }
  } catch (err) {
    result.firestoreRest = { error: String(err) }
  }

  // --- Test 2: Admin SDK (cg-dashboard-1b1d3) ---
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')

    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.GCP_PROJECT_ID!,
            clientEmail: process.env.GCP_CLIENT_EMAIL!,
            privateKey: process.env.GCP_PRIVATE_KEY!.replace(/\\n/g, '\n')
          })
        })

    const db = getFirestore(app)
    const snapshot = await db.collection('priceLists').where('active', '==', true).limit(1).get()

    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      const data = doc.data()
      result.adminSdk = {
        documentFound: true,
        documentId: doc.id,
        documentFields: Object.keys(data),
        screenPrintGridCount: data.screenPrintGrids?.length ?? 0,
        screenPrintGridNames: (data.screenPrintGrids ?? []).map((g: { name?: string }) => g.name ?? '(no name)'),
      }
    } else {
      result.adminSdk = { documentFound: false }
    }
  } catch (err) {
    result.adminSdk = { error: String(err) }
  }

  // --- Test 3: S&S API ---
  try {
    const customerNumber = process.env.SS_CUSTOMER_NUMBER
    const ssApiKey = process.env.SS_API_KEY
    const base = process.env.SS_API_BASE_URL || 'https://api.ssactivewear.com/v2'

    if (!customerNumber || !ssApiKey) {
      result.ssApi = { error: 'SS_CUSTOMER_NUMBER or SS_API_KEY not set' }
    } else {
      const credentials = Buffer.from(`${customerNumber}:${ssApiKey}`).toString('base64')
      const res = await fetch(`${base}/products/IND4000`, {
        headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
      })
      result.ssApi = { status: res.status, ok: res.ok, style: 'IND4000' }
      if (res.ok) {
        const data = await res.json() as unknown[]
        const variants = Array.isArray(data) ? data : [data]
        const first = variants[0] as Record<string, unknown> | undefined
        result.ssApi = {
          ...result.ssApi as object,
          variantCount: variants.length,
          firstVariantKeys: first ? Object.keys(first) : [],
          yourPrice: first?.yourPrice ?? null,
          salePrice: first?.salePrice ?? null,
          price: first?.price ?? null,
        }
      } else {
        const text = await res.text().catch(() => '')
        result.ssApi = { ...result.ssApi as object, responseBody: text.slice(0, 500) }
      }
    }
  } catch (err) {
    result.ssApi = { error: String(err) }
  }

  return NextResponse.json(result, { status: 200 })
}
