import type { CheckInput, CheckPoint, Condition, EvalItem, PromptInput, Resolution, Rule, RuleAction, Selection, StopInput, ToolCallInput, Verdict } from './types.ts'

export const FIELD_LIMIT = 32 * 1024
export const EVALUATOR_LIMIT = 4 * 1024

const FILE_TOOLS = ['Edit', 'Write', 'MultiEdit']
const POINT_ACTIONS: Record<CheckPoint, readonly RuleAction[]> = { 'before-call': ['block', 'ask'], 'after-call': ['warn'], stop: ['block', 'warn'], prompt: ['block', 'warn'] }
const STRICTNESS: readonly RuleAction[] = ['block', 'ask', 'warn']
const HARD_ACTIONS: readonly RuleAction[] = ['block', 'ask']

export function select(rules: readonly Rule[], point: CheckPoint, input: CheckInput): Selection {
  const actions = POINT_ACTIONS[point]
  const decided: Rule[] = []
  const pending: EvalItem[] = []
  for (const rule of rules) {
    if (!actions.includes(rule.action)) continue
    if (!ruleCovers(rule, input)) continue
    const evaluations = matchConditions(rule, input)
    if (evaluations === undefined) continue
    if (evaluations.length === 0) {
      decided.push(rule)
      continue
    }
    for (const { condition, field, value } of evaluations) {
      pending.push({ ruleId: rule.id, rule, question: condition.pattern, field, content: value.slice(0, EVALUATOR_LIMIT), body: rule.body })
    }
  }
  return { decided, pending }
}

export function coveringRules(rules: readonly Rule[], input: CheckInput): string[] {
  return rules.filter((rule) => ruleCovers(rule, input)).map((rule) => rule.id)
}

export function resolve(selection: Selection, verdicts: ReadonlyMap<string, Verdict>): Resolution {
  const applying = [...selection.decided]
  const failures: Rule[] = []
  const softFailures: Rule[] = []
  const pendingRules = new Map(selection.pending.map((item) => [item.ruleId, item.rule]))
  for (const [ruleId, rule] of pendingRules) {
    const verdict = verdicts.get(ruleId) ?? 'failed'
    if (verdict === 'holds') applying.push(rule)
    else if (verdict === 'failed' && HARD_ACTIONS.includes(rule.action)) failures.push(rule)
    else if (verdict === 'failed') softFailures.push(rule)
  }
  const actions = new Set<RuleAction>(applying.map((rule) => rule.action))
  if (failures.length > 0) actions.add('block')
  const action = STRICTNESS.find((candidate) => actions.has(candidate))
  if (action === undefined) return { action: 'pass', rules: [], message: '', failures, softFailures }
  const rules = applying.filter((rule) => rule.action === action)
  const lines = rules.map(ruleMessage)
  if (action === 'block') lines.push(...failures.map((rule) => checkFailedLine(rule.id)))
  return { action, rules, message: lines.join('\n\n'), failures, softFailures }
}

export function ruleMessage(rule: Rule): string {
  const text = rule.body === '' ? `this action matches the rule ${rule.name}` : rule.body
  return `[cc-enforcer:${rule.id}] ${text}`
}

export function findingMessage(rule: Rule, tool: string, target: string | undefined, finding: string): string {
  const flagged = target === undefined ? tool : `${tool} ${target}`
  const lines = [`[cc-enforcer:${rule.id}] review flagged ${flagged}: "${finding}"`]
  if (rule.body !== '') lines.push(rule.body)
  return lines.join('\n')
}

export function checkFailedMessage(ruleIds: readonly string[] = []): string {
  if (ruleIds.length === 0) return '[cc-enforcer] the check could not finish, so this was not run'
  return ruleIds.map(checkFailedLine).join('\n\n')
}

function checkFailedLine(ruleId: string): string {
  return `[cc-enforcer:${ruleId}] the check could not finish, so this was not run`
}

function ruleCovers(rule: Rule, input: CheckInput): boolean {
  if (isStop(input)) return rule.event === 'stop' || (rule.event === 'all' && rule.kind === 'matcher')
  if (isPrompt(input)) return rule.event === 'prompt' || rule.event === 'all'
  return eventCoversTool(rule, input.tool) && toolMatcherCovers(rule.toolMatcher, input.tool)
}

function isStop(input: CheckInput): input is StopInput {
  return 'transcript' in input
}

function isPrompt(input: CheckInput): input is PromptInput {
  return 'userPrompt' in input
}

function eventCoversTool(rule: Rule, tool: string): boolean {
  if (rule.event === 'all') return true
  if (rule.event === 'bash') return tool === 'Bash'
  if (rule.event === 'file') return FILE_TOOLS.includes(tool)
  return false
}

function toolMatcherCovers(toolMatcher: string | undefined, tool: string): boolean {
  if (toolMatcher === undefined || toolMatcher === '*') return true
  return toolMatcher.split('|').includes(tool)
}

type PendingEvaluation = { condition: Condition; field: string; value: string }

function matchConditions(rule: Rule, input: CheckInput): PendingEvaluation[] | undefined {
  const evaluations: PendingEvaluation[] = []
  for (const condition of rule.conditions) {
    const field = condition.simple ? simpleField(rule, input) : condition.field
    if (field === undefined) return undefined
    const value = fieldValue(field, input)
    if (value === undefined) return undefined
    if (condition.operator === 'llm_evaluate') {
      evaluations.push({ condition, field, value })
      continue
    }
    if (!matcherHolds(condition, value)) return undefined
  }
  return evaluations
}

function simpleField(rule: Rule, input: CheckInput): string | undefined {
  if (isStop(input)) return 'transcript'
  if (isPrompt(input)) return 'user_prompt'
  const tool = input.tool
  if (tool === 'Bash' && (rule.event === 'bash' || rule.event === 'all')) return 'command'
  if (FILE_TOOLS.includes(tool) && (rule.event === 'file' || rule.event === 'all')) return 'new_text'
  return undefined
}

function fieldValue(field: string, input: CheckInput): string | undefined {
  if (isStop(input)) return field === 'transcript' ? input.transcript.slice(-FIELD_LIMIT) : undefined
  if (isPrompt(input)) return field === 'user_prompt' ? input.userPrompt.slice(0, FIELD_LIMIT) : undefined
  const value = rawFieldValue(field, input)
  return value === undefined ? undefined : value.slice(0, FIELD_LIMIT)
}

function rawFieldValue(field: string, { tool, args }: ToolCallInput): string | undefined {
  if (Object.hasOwn(args, field)) {
    const value = args[field]
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  if (tool === 'Write' && field === 'new_text') return text(args.content)
  if (tool === 'Edit') {
    if (field === 'new_text' || field === 'content') return text(args.new_string)
    if (field === 'old_text') return text(args.old_string)
  }
  if (tool === 'MultiEdit') {
    if (field === 'new_text' || field === 'content') return joinedEdits(args.edits, 'new_string')
    if (field === 'old_text') return joinedEdits(args.edits, 'old_string')
  }
  return undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function joinedEdits(edits: unknown, key: 'new_string' | 'old_string'): string | undefined {
  if (!Array.isArray(edits)) return undefined
  return edits.map((edit) => (typeof edit?.[key] === 'string' ? edit[key] : '')).join(' ')
}

function matcherHolds(condition: Condition, value: string): boolean {
  switch (condition.operator) {
    case 'regex_match':
      return condition.regex?.test(value) ?? false
    case 'contains':
      return value.includes(condition.pattern)
    case 'equals':
      return value === condition.pattern
    case 'not_contains':
      return !value.includes(condition.pattern)
    case 'starts_with':
      return value.startsWith(condition.pattern)
    case 'ends_with':
      return value.endsWith(condition.pattern)
    default:
      return false
  }
}
