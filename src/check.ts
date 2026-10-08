import { verdicts, type EvaluatorIo } from './evaluator/index.ts'
import { checkFailedMessage, resolve, select, type CheckInput, type CheckPoint, type EvalItem, type Resolution, type Rule, type StopInput, type ToolCallInput, type Verdict } from './rules/index.ts'

export function createCheck() {
  const inFlightRuleIds = new Map<string, string[]>()
  const inFlightPromptBlockRuleIds = new Map<string, string[]>()

  return {
    async run(point: CheckPoint, rules: readonly Rule[], input: CheckInput, evaluator: EvaluatorIo, key?: string): Promise<Resolution> {
      const selection = select(rules, point, input)
      if (key !== undefined && point === 'prompt') {
        const selected = [...selection.decided, ...selection.pending.map((item) => item.rule)]
        inFlightPromptBlockRuleIds.set(key, [...new Set(selected.filter((rule) => rule.action === 'block').map((rule) => rule.id))])
      } else if (key !== undefined) {
        inFlightRuleIds.set(key, [...selection.decided.map((rule) => rule.id), ...new Set(selection.pending.map((item) => item.ruleId))])
      }
      return resolve(selection, await verdicts(selection.pending, evaluator))
    },
    runStop(rules: readonly Rule[], input: StopInput, atLimit: ReadonlySet<string>): { resolution: Resolution; overridden: Rule[] } {
      const selection = select(rules, 'stop', input)
      const overridden = selection.decided.filter((rule) => rule.action === 'block' && atLimit.has(rule.id))
      const decided = selection.decided.filter((rule) => !overridden.includes(rule))
      return { resolution: resolve({ ...selection, decided }, new Map<string, Verdict>()), overridden }
    },
    runAfterCall(rules: readonly Rule[], input: ToolCallInput): Resolution & { deferred: EvalItem[] } {
      const { decided, pending } = select(rules, 'after-call', input)
      return { ...resolve({ decided, pending: [] }, new Map<string, Verdict>()), deferred: pending }
    },
    settle(key?: string): void {
      if (key !== undefined) inFlightRuleIds.delete(key)
      if (key !== undefined) inFlightPromptBlockRuleIds.delete(key)
    },
    promptBackstop(key: string): string | undefined {
      const blockRuleIds = inFlightPromptBlockRuleIds.get(key) ?? []
      inFlightPromptBlockRuleIds.delete(key)
      return blockRuleIds.length === 0 ? undefined : checkFailedMessage(blockRuleIds)
    },
    backstop(key?: string): string {
      const ruleIds = key === undefined ? [] : inFlightRuleIds.get(key) ?? []
      if (key !== undefined) inFlightRuleIds.delete(key)
      return checkFailedMessage(ruleIds)
    },
  }
}
