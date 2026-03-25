export interface AgentTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: unknown) => Promise<unknown>
}

export interface AgentTask {
  systemPrompt: string
  tools: string[]
}

export interface PricingProposalLine {
  lineId: number
  sku: string | null
  description: string | null
  quantity: number
  lineType: 'garment' | 'decoration' | 'service' | 'unclassified'
  vendorCost?: number
  marginPercent?: number
  markupPercent?: number
  calculatedPrice: number
  breakdown: string
  decorationType?: string
  gridName?: string
  skip?: boolean
  skipReason?: string
}

export type AgentEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'proposal'; lines: PricingProposalLine[] }
  | { type: 'complete'; summary: string }
  | { type: 'error'; message: string }

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
