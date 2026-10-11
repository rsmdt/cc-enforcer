import type { Rejection } from './sources/index.ts'

export type RecordedKind =
  | 'block'
  | 'warn'
  | 'loop-guard-override'
  | 'finding'
  | 'review-finding'
  | 'review-failed'
  | 'not-reviewed'
  | 'check-failed'
  | 'rule-rejected'
  | 'activity'
  | 'prompt'
  | 'turn-end'

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
  id?: string
  queue?: string
  agentId?: string
  operation?: string
  input?: Record<string, unknown>
  status?: string
  reason?: string
  covering?: string[]
  matched?: string[]
  started?: string
  text?: string
  outcome?: string
  ruleIds?: string[]
  time: string
}

export type RecorderIo = {
  home(): Promise<string>
  sessionId(): Promise<string>
  cwd(): Promise<string>
  read(path: string): Promise<string>
  write(path: string, text: string): Promise<void>
  run(argv: string[]): Promise<unknown>
  showUser(text: string): void
}

const FILE_TOOLS = ['Edit', 'Write', 'MultiEdit']

const MAKE_OWNER_ONLY_LOG = 'umask 077 && mkdir -p "$1" && chmod 700 "$2" "$3" "$1" && : >> "$4" && chmod 600 "$4"'

const UNKNOWN_PROJECT = 'unknown-project'

type LogLocation = { base: string; projects: string; folder: string; path: string }

export function projectFolderName(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}

export function logRoot(home: string): string {
  return `${home}/.cc-enforcer`
}

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
  let location: Promise<LogLocation> | undefined
  let earlier: Promise<{ text: string; events: RecordedEvent[] }> | undefined

  function countHit(event: RecordedEvent): void {
    if (event.ruleId !== undefined && !NOT_A_HIT.includes(event.kind)) hitCounts.set(event.ruleId, (hitCounts.get(event.ruleId) ?? 0) + 1)
  }

  function locate(io: RecorderIo): Promise<LogLocation> {
    location ??= (async () => {
      const [home, sessionId, cwd] = await Promise.all([io.home(), io.sessionId(), io.cwd().catch(() => UNKNOWN_PROJECT)])
      const base = logRoot(home)
      const projects = `${base}/projects`
      const folder = `${projects}/${projectFolderName(cwd)}`
      return { base, projects, folder, path: `${folder}/${sessionId}.jsonl` }
    })().catch((error) => {
      location = undefined
      throw error
    })
    return location
  }

  function loadEarlier(io: RecorderIo): Promise<{ text: string; events: RecordedEvent[] }> {
    earlier ??= (async () => {
      const { path } = await locate(io)
      const read = await io.read(path).catch(() => '')
      const text = read === '' || read.endsWith('\n') ? read : `${read}\n`
      const events = text.split('\n').flatMap((line) => {
        try {
          return line === '' ? [] : [JSON.parse(line) as RecordedEvent]
        } catch {
          return []
        }
      })
      for (const event of events) countHit(event)
      return { text, events }
    })().catch((error) => {
      earlier = undefined
      throw error
    })
    return earlier
  }

  async function makeOwnerOnly(io: RecorderIo, { base, projects, folder, path }: LogLocation): Promise<void> {
    if (ownerOnlyLogs.has(path)) return
    ownerOnlyLogs.add(path)
    await io.run(['sh', '-c', MAKE_OWNER_ONLY_LOG, 'sh', folder, base, projects, path]).catch(() => undefined)
  }

  function append(io: RecorderIo, event: RecordedEvent): void {
    countHit(event)
    lines.push(JSON.stringify(event))
    writing = writing
      .then(async () => {
        const where = await locate(io)
        const { text } = await loadEarlier(io)
        await makeOwnerOnly(io, where)
        await io.write(where.path, text + lines.join('\n') + '\n')
      })
      .catch(() => undefined)
  }

  return {
    async earlier(io: RecorderIo): Promise<RecordedEvent[]> {
      return (await loadEarlier(io)).events
    },
    async logPath(io: RecorderIo): Promise<string> {
      return (await locate(io)).path
    },
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
