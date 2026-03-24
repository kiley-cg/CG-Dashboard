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

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-extension-api-key')
  if (process.env.EXTENSION_API_KEY && apiKey !== process.env.EXTENSION_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getFirestore(getApp())
    const snapshot = await db.collection('priceLists').orderBy('name').get()
    const lists = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }))
    return NextResponse.json({ priceLists: lists })
  } catch {
    // Fallback: return the single default
    return NextResponse.json({ priceLists: [{ id: 'default', name: 'Default (Frontier)' }] })
  }
}
