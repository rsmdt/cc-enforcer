import type { Resolution } from '../rules/index.ts'

export type PromptDecision = { drop: string } | { context: string } | 'next'

export function promptDecision(resolution: Resolution): PromptDecision {
  if (resolution.action === 'block') return { drop: resolution.message }
  if (resolution.action === 'warn') return { context: resolution.message }
  return 'next'
}
