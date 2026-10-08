import type { Resolution } from '../rules/index.ts'

export type GateDecision = { deny: string } | 'next'
export type AskUser = (question: string, options: { options: string[]; header: string }) => Promise<string>

const ALLOW = 'Allow'
const DENY = 'Deny'
const ASK_HEADER = 'cc-enforcer'

export async function gateDecision(resolution: Resolution, askUser: AskUser): Promise<GateDecision> {
  if (resolution.action === 'block') return { deny: resolution.message }
  if (resolution.action !== 'ask') return 'next'
  const answer = await askUser(askQuestion(resolution), { options: [ALLOW, DENY], header: ASK_HEADER }).catch(() => DENY)
  return answer === ALLOW ? 'next' : { deny: resolution.message }
}

function askQuestion(resolution: Resolution): string {
  const names = resolution.rules.map((rule) => rule.name).join(', ')
  return `${resolution.message}\n\nThe rule ${names} asks before this call runs. Allow it?`
}
