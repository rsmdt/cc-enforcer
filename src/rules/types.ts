export type RuleEvent = 'bash' | 'file' | 'stop' | 'prompt' | 'all'
export type RuleAction = 'block' | 'ask' | 'warn'
export type Operator = 'regex_match' | 'contains' | 'equals' | 'not_contains' | 'starts_with' | 'ends_with' | 'llm_evaluate'
export type RuleSource = 'project' | 'personal'

export type Condition = {
  field: string
  operator: Operator
  pattern: string
  simple: boolean
  regex?: RegExp
}

export type ParsedRule = {
  name: string
  enabled: boolean
  event: RuleEvent
  action: RuleAction
  toolMatcher?: string
  conditions: Condition[]
  body: string
  kind: 'matcher' | 'evaluator'
}

export type Rule = ParsedRule & {
  source: RuleSource
  id: string
}

export type ParseOutcome =
  | { ok: true; rule: ParsedRule; warnings: string[] }
  | { ok: false; problem: string }

export type ToolCallInput = {
  tool: string
  args: Record<string, unknown>
}

export type StopInput = {
  transcript: string
}

export type PromptInput = {
  userPrompt: string
}

export type CheckInput = ToolCallInput | StopInput | PromptInput

export type CheckPoint = 'before-call' | 'after-call' | 'stop' | 'prompt'

export type EvalItem = {
  ruleId: string
  rule: Rule
  question: string
  field: string
  content: string
  body: string
}

export type Selection = {
  decided: Rule[]
  pending: EvalItem[]
}

export type Verdict = 'holds' | 'does-not-hold' | 'failed'

export type Resolution = {
  action: RuleAction | 'pass'
  rules: Rule[]
  message: string
  failures: Rule[]
  softFailures: Rule[]
}
