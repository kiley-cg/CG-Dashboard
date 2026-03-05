import type { AgentTool } from '../types'

const tools = new Map<string, AgentTool>()

export function registerTool(tool: AgentTool): void {
  tools.set(tool.name, tool)
}

export function getTool(name: string): AgentTool {
  const tool = tools.get(name)
  if (!tool) throw new Error(`Tool "${name}" not found in registry`)
  return tool
}

export function getToolDefs(names: string[]) {
  return names.map(n => {
    const t = getTool(n)
    return { name: t.name, description: t.description, input_schema: t.inputSchema }
  })
}

