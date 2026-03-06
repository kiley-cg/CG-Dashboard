import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import type { PricingProposalLine } from '@/lib/agent/types'

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
      })
    })
  }
  return getFirestore()
}

export interface AgentMemory {
  id: string
  type: 'order' | 'correction' | 'preference' | 'vendor_cost' | 'general'
  content: string
  data: Record<string, unknown>
  tags: string[]
  createdAt: FirebaseFirestore.Timestamp
  source: string
}

export async function saveMemory(memory: {
  type: AgentMemory['type']
  content: string
  tags: string[]
  data: Record<string, unknown>
  source: string
}): Promise<string> {
  const db = getDb()
  const ref = await db.collection('agentMemories').add({
    ...memory,
    createdAt: new Date()
  })
  return ref.id
}

export async function searchMemories(tags: string[], limit = 15): Promise<AgentMemory[]> {
  if (tags.length === 0) return []

  try {
    const db = getDb()
    // Firestore array-contains-any supports up to 30 values
    const queryTags = tags.slice(0, 30)
    const snapshot = await db
      .collection('agentMemories')
      .where('tags', 'array-contains-any', queryTags)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AgentMemory))
  } catch (err) {
    console.error('Memory search failed:', err)
    return []
  }
}

export async function saveOrderSummary(summary: {
  orderNumber: string
  customer: string
  lines: PricingProposalLine[]
  source: string
}): Promise<void> {
  const { orderNumber, customer, lines, source } = summary

  const applicableLines = lines.filter(l => !l.skip)
  const garmentLines = applicableLines.filter(l => l.lineType === 'garment')
  const decoLines = applicableLines.filter(l => l.lineType === 'decoration')

  const styles = [...new Set(garmentLines.map(l => l.sku?.split('-')[0]).filter(Boolean))]
  const decoTypes = [...new Set(decoLines.map(l => l.decorationType).filter(Boolean))]
  const totalQty = garmentLines.reduce((sum, l) => sum + l.quantity, 0)

  const tags = [
    `order:${orderNumber}`,
    ...(customer !== 'Unknown' ? [`customer:${customer}`] : []),
    ...styles.map(s => `style:${s}`),
    ...decoTypes.map(d => `deco:${d}`)
  ]

  const linesSummary = applicableLines.map(l =>
    `${l.description || l.sku}: $${l.calculatedPrice.toFixed(2)} (${l.breakdown})`
  ).join('; ')

  const content = `Order #${orderNumber} for ${customer}: ${totalQty} units. Priced ${applicableLines.length} lines. ${linesSummary}`

  await saveMemory({
    type: 'order',
    content,
    tags,
    data: {
      orderNumber,
      customer,
      totalQuantity: totalQty,
      lineCount: applicableLines.length,
      styles,
      decorationTypes: decoTypes,
      lines: applicableLines.map(l => ({
        lineId: l.lineId,
        description: l.description,
        sku: l.sku,
        quantity: l.quantity,
        lineType: l.lineType,
        calculatedPrice: l.calculatedPrice,
        vendorCost: l.vendorCost,
        marginPercent: l.marginPercent,
        markupPercent: l.markupPercent
      }))
    },
    source
  })
}
