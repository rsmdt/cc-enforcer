import type { EvalItem, RuleSource } from '../rules/index.ts'

export const REVIEW_CAP = 50
export const MAIN_QUEUE = 'main'

export type QueuedCall = {
  toolUseId: string
  tool: string
  target: string | undefined
  items: EvalItem[]
}

export type TakenQueue = {
  calls: QueuedCall[]
  notReviewed: number
}

export function queueKey(agentId: string | undefined): string {
  return agentId ?? MAIN_QUEUE
}

export function bySource(calls: readonly QueuedCall[]): QueuedCall[][] {
  const batches = new Map<RuleSource, QueuedCall[]>()
  for (const call of calls) {
    for (const item of call.items) {
      const batch = batches.get(item.rule.source) ?? []
      const queued = batch.find((entry) => entry.toolUseId === call.toolUseId)
      if (queued) queued.items.push(item)
      else batch.push({ ...call, items: [item] })
      batches.set(item.rule.source, batch)
    }
  }
  return [...batches.values()]
}

export function createReviewer() {
  const queues = new Map<string, TakenQueue>()
  let pendingFindings: string[] = []

  function take(agent: string): TakenQueue {
    const queue = queues.get(agent) ?? { calls: [], notReviewed: 0 }
    queues.delete(agent)
    return queue
  }

  return {
    queue(agent: string, call: QueuedCall): void {
      const queue = queues.get(agent) ?? { calls: [], notReviewed: 0 }
      if (queue.calls.length < REVIEW_CAP) queue.calls.push(call)
      else queue.notReviewed++
      queues.set(agent, queue)
    },
    take,
    reset(): number {
      const { calls, notReviewed } = take(MAIN_QUEUE)
      return calls.length + notReviewed
    },
    pending(): readonly string[] {
      return pendingFindings
    },
    show(findings: readonly string[]): void {
      pendingFindings = [...pendingFindings, ...findings]
    },
    clear(): void {
      pendingFindings = []
    },
  }
}
