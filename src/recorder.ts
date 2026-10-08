import type { Rejection } from './sources/index.ts'

export type RecordedKind = 'block' | 'warn' | 'loop-guard-override' | 'finding' | 'review-finding' | 'review-failed' | 'not-reviewed' | 'check-failed' | 'rule-rejected'

export type RecordedEvent = {
  kind: RecordedKind
  ruleId?: string
  ruleName?: string
  action?: string
  event?: string
  agentLabel?: string
  toolUseId?: string
  tool?: string
  target?: string
  path?: string
  problem?: string
  count?: number
  time: string
}

export type RecorderIo = {
  home(): Promise<string>
  sessionId(): Promise<string>
  write(path: string, text: string): Promise<void>
  run(argv: string[]): Promise<unknown>
  showUser(text: string): void
}

const FILE_TOOLS = ['Edit', 'Write', 'MultiEdit']

const MAKE_OWNER_ONLY_LOG = 'umask 077 && mkdir -p "$1" && chmod 700 "$2" "$1" && : >> "$3" && chmod 600 "$3"'

export const MAIN_SESSION_LABEL = 'main session'
export const WORKFLOW_AGENT_LABEL = 'workflow agent'

export function agentLabel(agentId: string | undefined, agents: ReadonlyArray<{ id: string; type: string }>): string {
  if (agentId === undefined) return MAIN_SESSION_LABEL
  return agents.find((agent) => agent.id === agentId)?.type ?? WORKFLOW_AGENT_LABEL
}

export function toolTarget(tool: string, args: Record<string, unknown>): string | undefined {
  return FILE_TOOLS.includes(tool) && typeof args.file_path === 'string' ? args.file_path : undefined
}

const NOT_A_HIT: readonly RecordedKind[] = ['check-failed', 'rule-rejected', 'loop-guard-override', 'review-failed', 'not-reviewed']

export const HOOKIFY_NOTICE =
  'cc-enforcer: the Hookify plugin is also enabled. Both plugins would enforce the same rule files (hookify.*.local.md), so every rule would apply twice. Disable Hookify in /plugin.'

export function createRecorder() {
  const lines: string[] = []
  const hitCounts = new Map<string, number>()
  const ownerOnlyLogs = new Set<string>()
  let writing: Promise<void> = Promise.resolve()

  async function makeOwnerOnly(io: RecorderIo, home: string, logPath: string): Promise<void> {
    if (ownerOnlyLogs.has(logPath)) return
    ownerOnlyLogs.add(logPath)
    const baseFolder = `${home}/.cc-enforcer`
    const logFolder = `${baseFolder}/logs`
    await io.run(['sh', '-c', MAKE_OWNER_ONLY_LOG, 'sh', logFolder, baseFolder, logPath]).catch(() => undefined)
  }

  function append(io: RecorderIo, event: RecordedEvent): void {
    if (event.ruleId !== undefined && !NOT_A_HIT.includes(event.kind)) hitCounts.set(event.ruleId, (hitCounts.get(event.ruleId) ?? 0) + 1)
    lines.push(JSON.stringify(event))
    const snapshot = lines.join('\n') + '\n'
    writing = writing
      .then(async () => {
        const [home, sessionId] = await Promise.all([io.home(), io.sessionId()])
        const logPath = `${home}/.cc-enforcer/logs/${sessionId}.jsonl`
        await makeOwnerOnly(io, home, logPath)
        await io.write(logPath, snapshot)
      })
      .catch(() => undefined)
  }

  return {
    record(io: RecorderIo, event: Omit<RecordedEvent, 'time'>): void {
      append(io, { ...event, time: new Date().toISOString() })
    },
    flush(): Promise<void> {
      return writing
    },
    hits(ruleId: string): number {
      return hitCounts.get(ruleId) ?? 0
    },
    hookifyAlsoEnabled(io: RecorderIo): void {
      io.showUser(HOOKIFY_NOTICE)
    },
    shown(io: RecorderIo, text: string, event: Omit<RecordedEvent, 'time'>): void {
      append(io, { ...event, time: new Date().toISOString() })
      io.showUser(text)
    },
    rejected(io: RecorderIo, rejection: Rejection): void {
      const outcome = rejection.lastValidKept ? 'the edit was rejected and its last valid version still applies' : 'is not applied'
      io.showUser(`cc-enforcer: the rule file ${rejection.path} is invalid and ${outcome}: ${rejection.problem}`)
      append(io, { kind: 'rule-rejected', path: rejection.path, problem: rejection.problem, time: new Date().toISOString() })
    },
  }
}
