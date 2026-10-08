export const LOOP_LIMIT = 3
export const TRANSCRIPT_READ_LIMIT = 4 * 1024 * 1024

export type TranscriptIo = {
  stat(path: string): Promise<{ size: number }>
  read(path: string): Promise<string>
}

export async function readTranscript(io: TranscriptIo, path: string | undefined, lastAssistantMessage: string | undefined): Promise<string> {
  const fallback = lastAssistantMessage ?? ''
  if (!path) return fallback
  const { size } = await io.stat(path)
  return size > TRANSCRIPT_READ_LIMIT ? fallback : io.read(path)
}

export function createTurnGuard() {
  const consecutiveBlocks = new Map<string, Map<string, number>>()

  return {
    atLimit(agent: string): Set<string> {
      const counts = consecutiveBlocks.get(agent) ?? new Map<string, number>()
      return new Set([...counts].filter(([, count]) => count >= LOOP_LIMIT).map(([ruleId]) => ruleId))
    },
    blocked(agent: string, ruleIds: readonly string[]): void {
      const previous = consecutiveBlocks.get(agent) ?? new Map<string, number>()
      consecutiveBlocks.set(agent, new Map(ruleIds.map((ruleId) => [ruleId, (previous.get(ruleId) ?? 0) + 1])))
    },
    ended(agent: string): void {
      consecutiveBlocks.delete(agent)
    },
    reset(): void {
      consecutiveBlocks.clear()
    },
  }
}
