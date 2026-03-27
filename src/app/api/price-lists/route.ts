import { NextResponse } from 'next/server'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.GCP_PROJECT_ID!,
      clientEmail: process.env.GCP_CLIENT_EMAIL!,
      privateKey: process.env.GCP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

const FALLBACK_PRICE_LISTS = [
  { id: 'frontier', name: 'Frontier' },
  { id: 'oregon-screen-impressions', name: 'Oregon Screen Impressions' },
]

export async function GET() {
  try {
    const db = getFirestore(getApp())
    const snapshot = await db.collection('priceLists').orderBy('name').get()
    if (snapshot.empty) {
      return NextResponse.json({ priceLists: FALLBACK_PRICE_LISTS })
    }
    const lists = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }))
    return NextResponse.json({ priceLists: lists })
  } catch {
    return NextResponse.json({ priceLists: FALLBACK_PRICE_LISTS })
  }
}
