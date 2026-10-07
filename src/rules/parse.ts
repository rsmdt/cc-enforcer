import { splitFrontmatter, type ConditionEntry, type Frontmatter } from './frontmatter.ts'
import { translatePattern } from './regex.ts'
import type { Condition, Operator, ParseOutcome, ParsedRule, Rule, RuleAction, RuleEvent, RuleSource } from './types.ts'

export const RULE_FILE_PATTERN = /^hookify\.(.+)\.local\.md$/

const EVENTS: readonly RuleEvent[] = ['bash', 'file', 'stop', 'prompt', 'all']
const ACTIONS: readonly RuleAction[] = ['block', 'ask', 'warn']
const OPERATORS: readonly Operator[] = ['regex_match', 'contains', 'equals', 'not_contains', 'starts_with', 'ends_with', 'llm_evaluate']

class RuleProblem extends Error {}

export function defaultName(fileName: string): string {
  return RULE_FILE_PATTERN.exec(fileName)?.[1] ?? fileName
}

export function compileRule(rule: ParsedRule, source: RuleSource): Rule {
  return { ...rule, source, id: `${source}:${rule.name}` }
}

export function parseRuleFile(fileName: string, text: string): ParseOutcome {
  const split = splitFrontmatter(text)
  if (!split.ok) return split
  try {
    return buildRule(fileName, split.frontmatter, split.body)
  } catch (error) {
    if (error instanceof RuleProblem) return { ok: false, problem: error.message }
    throw error
  }
}

function buildRule(fileName: string, frontmatter: Frontmatter, body: string): ParseOutcome {
  const name = textField(frontmatter, 'name') ?? defaultName(fileName)
  const enabled = frontmatter.enabled ?? true
  if (typeof enabled !== 'boolean') throw new RuleProblem('"enabled" must be true or false')
  const event = oneOf(textField(frontmatter, 'event') ?? 'all', EVENTS, 'event')
  const action = oneOf(textField(frontmatter, 'action') ?? 'warn', ACTIONS, 'action')
  const toolMatcher = textField(frontmatter, 'tool_matcher')
  const conditions = readConditions(frontmatter)

  if (action === 'ask' && (event === 'stop' || event === 'prompt')) {
    throw new RuleProblem(`the action "ask" is not allowed on the ${event} event`)
  }
  if (event === 'stop' && conditions.some((condition) => condition.operator === 'llm_evaluate')) {
    throw new RuleProblem('an llm_evaluate condition is not allowed on the stop event')
  }

  const warnings = body === '' ? ['the body is empty, so the default message is used'] : []
  const kind = conditions.some((condition) => condition.operator === 'llm_evaluate') ? 'evaluator' : 'matcher'
  return {
    ok: true,
    rule: { name, enabled, event, action, ...(toolMatcher === undefined ? {} : { toolMatcher }), conditions, body, kind },
    warnings,
  }
}

function readConditions(frontmatter: Frontmatter): Condition[] {
  const declared = frontmatter.conditions
  if (declared !== undefined) {
    if (!Array.isArray(declared)) throw new RuleProblem('"conditions" must be a list of conditions')
    return declared.map((entry) => {
      if (typeof entry === 'string') throw new RuleProblem('each condition must have "field", "operator" and "pattern"')
      return conditionFrom(entry)
    })
  }
  const pattern = textField(frontmatter, 'pattern')
  if (pattern === undefined) throw new RuleProblem('the rule has no pattern and no conditions, so it can never match')
  return [withRegex({ field: '', operator: 'regex_match', pattern, simple: true })]
}

function conditionFrom(entry: ConditionEntry): Condition {
  const field = entry.field
  if (!field) throw new RuleProblem('a condition has no field')
  const operator = oneOf(entry.operator ?? 'regex_match', OPERATORS, 'operator')
  const pattern = entry.pattern
  if (pattern === undefined) throw new RuleProblem(`the condition on "${field}" has no pattern`)
  return withRegex({ field, operator, pattern, simple: false })
}

function withRegex(condition: Condition): Condition {
  if (condition.pattern === '') {
    throw new RuleProblem(`the pattern${condition.simple ? '' : ` of the condition on "${condition.field}"`} is empty`)
  }
  if (condition.operator !== 'regex_match') return condition
  const translated = translatePattern(condition.pattern)
  if (!translated.ok) throw new RuleProblem(`the pattern "${condition.pattern}": ${translated.problem}`)
  return { ...condition, regex: translated.regex }
}

function textField(frontmatter: Frontmatter, key: string): string | undefined {
  const value = frontmatter[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new RuleProblem(`"${key}" must be text`)
  return value
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new RuleProblem(`unknown ${label} "${value}"; expected one of ${allowed.join(', ')}`)
  }
  return value as T
}
