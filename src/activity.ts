import { toolTarget } from './recorder.ts'
import type { ToolCallInput } from './rules/index.ts'

export const ACTIVITY_LIMIT = 200
const OPERATION_LIMIT = 80
const OPERATION_FIELDS = ['command', 'file_path', 'path', 'pattern', 'url']

export type ActivityStatus =
  | 'checking'
  | 'approved'
  | 'ignored'
  | 'blocked'
  | 'allowed by you'
  | 'denied by you'
  | 'warned'
  | 'queued for review'
  | 'reviewing'
  | 'flagged'
  | 'not reviewed'
  | 'check failed'
  | 'review failed'

export type ActivityKind = 'approved' | 'rejected' | 'cautioned' | 'pending' | 'ignored'

const KIND_OF: Record<ActivityStatus, ActivityKind> = {
  checking: 'pending',
  'queued for review': 'pending',
  reviewing: 'pending',
  approved: 'approved',
  ignored: 'ignored',
  'allowed by you': 'approved',
  blocked: 'rejected',
  'denied by you': 'rejected',
  'check failed': 'rejected',
  warned: 'cautioned',
  flagged: 'cautioned',
  'not reviewed': 'cautioned',
  'review failed': 'cautioned',
}

export const CHECKED_KINDS: readonly ActivityKind[] = ['approved', 'rejected', 'cautioned', 'pending']
export const ACTIVITY_KINDS: readonly ActivityKind[] = [...CHECKED_KINDS, 'ignored']
export const KIND_ICON: Record<ActivityKind, string> = { approved: '✓', rejected: '✗', cautioned: '!', pending: '…', ignored: '·' }
export const KIND_STYLE: Record<ActivityKind, { color?: string; dimColor?: boolean }> = {
  approved: { color: 'success' },
  rejected: { color: 'error' },
  cautioned: { color: 'warning' },
  pending: { color: 'suggestion' },
  ignored: { dimColor: true },
}
export const KIND_LABEL: Record<ActivityKind, string> = { approved: 'approved', rejected: 'rejected', cautioned: 'cautioned', pending: 'pending', ignored: 'ignored' }

export function kindOf(status: ActivityStatus): ActivityKind {
  return KIND_OF[status]
}

export type Activity = {
  id: string
  time: Date
  queue: string
  subject: string
  operation: string | undefined
  status: ActivityStatus
  reason?: string
  input?: Record<string, unknown>
  agentId?: string
  covering?: string[]
  matched?: string[]
}

export type ActivityRecord = {
  kind: 'activity'
  id: string
  queue: string
  agentId?: string
  tool: string
  operation?: string
  input?: Record<string, unknown>
  status: ActivityStatus
  reason?: string
  covering?: string[]
  matched?: string[]
  started: string
}

export function activityRecord(entry: Activity): ActivityRecord {
  return {
    kind: 'activity',
    id: entry.id,
    queue: entry.queue,
    agentId: entry.agentId,
    tool: entry.subject,
    operation: entry.operation,
    input: entry.input,
    status: entry.status,
    reason: entry.reason,
    covering: entry.covering,
    matched: entry.matched,
    started: entry.time.toISOString(),
  }
}

export function operationOf({ tool, args }: ToolCallInput): string | undefined {
  const file = toolTarget(tool, args)
  if (file !== undefined) return file
  const value = OPERATION_FIELDS.map((field) => args[field]).find((candidate) => typeof candidate === 'string')
  if (typeof value !== 'string') return undefined
  const firstLine = value.split('\n')[0]
  return firstLine.length > OPERATION_LIMIT ? `${firstLine.slice(0, OPERATION_LIMIT)}…` : firstLine
}

export function createActivity() {
  const entries: Activity[] = []
  const byId = new Map<string, Activity>()
  let changes: Activity[] = []
  const changed = (entry: Activity) => changes.push({ ...entry })
  const totals: Record<ActivityKind, number> = { approved: 0, rejected: 0, cautioned: 0, pending: 0, ignored: 0 }
  const recount = (entry: Activity, status: ActivityStatus) => {
    totals[kindOf(entry.status)]--
    totals[kindOf(status)]++
    entry.status = status
  }

  return {
    start(id: string, queue: string, subject: string, operation: string | undefined, status: ActivityStatus = 'checking', reason?: string, details: Pick<Activity, 'input' | 'agentId'> = {}): void {
      const entry: Activity = { id, time: new Date(), queue, subject, operation, status, reason, ...details }
      entries.push(entry)
      totals[kindOf(status)]++
      byId.set(id, entry)
      while (entries.length > ACTIVITY_LIMIT) byId.delete(entries.shift()!.id)
      changed(entry)
    },
    note(id: string, rules: Pick<Activity, 'covering' | 'matched'>): void {
      const entry = byId.get(id)
      if (entry !== undefined) Object.assign(entry, rules)
    },
    settle(id: string, status: ActivityStatus, reason?: string): void {
      const entry = byId.get(id)
      if (entry === undefined) return
      recount(entry, status)
      entry.reason = reason
      changed(entry)
    },
    expireQueued(queue: string): void {
      for (const entry of entries) {
        if (entry.queue !== queue || (entry.status !== 'queued for review' && entry.status !== 'reviewing')) continue
        recount(entry, 'not reviewed')
        changed(entry)
      }
    },
    drainChanges(): Activity[] {
      const drained = changes
      changes = []
      return drained
    },
    restore(records: readonly ActivityRecord[]): void {
      const restored = new Map<string, Activity>()
      for (const record of records) {
        if (byId.has(record.id)) continue
        restored.set(record.id, {
          id: record.id,
          time: new Date(record.started),
          queue: record.queue,
          subject: record.tool,
          operation: record.operation,
          status: kindOf(record.status) === 'pending' ? 'not reviewed' : record.status,
          reason: record.reason,
          input: record.input,
          agentId: record.agentId,
          covering: record.covering,
          matched: record.matched,
        })
      }
      const earlier = [...restored.values()]
      entries.unshift(...earlier)
      for (const entry of earlier) {
        byId.set(entry.id, entry)
        totals[kindOf(entry.status)]++
      }
      while (entries.length > ACTIVITY_LIMIT) byId.delete(entries.shift()!.id)
    },
    get(id: string): Activity | undefined {
      return byId.get(id)
    },
    list(): readonly Activity[] {
      return entries
    },
    totals(): Readonly<Record<ActivityKind, number>> {
      return totals
    },
  }
}

export function badgeText(entry: Activity): string {
  return entry.reason === undefined ? `cc-enforcer: ${entry.status}` : `cc-enforcer: ${entry.status} — ${entry.reason}`
}

export function activityTime(entry: Activity): string {
  return entry.time.toTimeString().slice(0, 8)
}

export function activityTarget(entry: Activity): string {
  return entry.operation === undefined ? entry.subject : `${entry.subject} ${entry.operation}`
}

export function activityDetail(entry: Activity): string | undefined {
  if (entry.status === 'approved' || entry.status === 'ignored') return undefined
  return entry.reason === undefined ? entry.status : `${entry.status} — ${entry.reason}`
}

const CARD_GAP = 1

export type StatCard = { kind: ActivityKind | 'checked'; lines: string[] }

export const CHECKED_STYLE = { bold: true }
const CHECKED_ICON = '#'

export function statCards(totals: Readonly<Record<ActivityKind, number>>, columns: number): StatCard[] {
  const checked = CHECKED_KINDS.reduce((sum, kind) => sum + totals[kind], 0)
  const cards = (label: (kind: ActivityKind) => string, checkedLabel: string): StatCard[] => [
    { kind: 'checked', lines: statCard(checkedLabel, checked) },
    ...ACTIVITY_KINDS.map((kind) => ({ kind, lines: statCard(label(kind), totals[kind]) })),
  ]
  const labelled = cards((kind) => KIND_LABEL[kind], 'checked')
  return rowWidth(labelled) <= columns ? labelled : cards((kind) => KIND_ICON[kind], CHECKED_ICON)
}

export function labelledCardsWidth(): number {
  return rowWidth(statCards({ approved: 0, rejected: 0, cautioned: 0, pending: 0, ignored: 0 }, Infinity))
}

export function statusLine(totals: Readonly<Record<ActivityKind, number>>): string {
  const checked = CHECKED_KINDS.reduce((sum, kind) => sum + totals[kind], 0)
  return [`${CHECKED_ICON}${checked}`, ...ACTIVITY_KINDS.map((kind) => `${KIND_ICON[kind]}${totals[kind]}`)].join(' ')
}

function rowWidth(cards: readonly StatCard[]): number {
  return cards.reduce((sum, card) => sum + card.lines[0].length + CARD_GAP, -CARD_GAP)
}

function statCard(label: string, count: number): string[] {
  const number = String(count)
  const inner = Math.max(label.length + 4, number.length + 2)
  const left = Math.floor((inner - number.length) / 2)
  const title = `─ ${label} `
  return [`╭${title}${'─'.repeat(inner - title.length)}╮`, `│${' '.repeat(left)}${number}${' '.repeat(inner - number.length - left)}│`, `╰${'─'.repeat(inner)}╯`]
}

export function cardRowCount(cards: readonly StatCard[], columns: number): number {
  let rows = 1
  let used = -CARD_GAP
  for (const card of cards) {
    const width = card.lines[0].length
    if (used >= 0 && used + CARD_GAP + width > columns) {
      rows++
      used = width
    } else {
      used += CARD_GAP + width
    }
  }
  return rows
}

export type LogWindow = { start: number; end: number; older: number; newer: number }

export function logWindow(entries: readonly Activity[], top: number | undefined, rows: number): LogWindow {
  const start = Math.min(top ?? Infinity, lastPageTop(entries, rows))
  let end = start
  let used = 0
  while (end < entries.length && (end === start || used + entryRows(entries[end]) <= rows)) used += entryRows(entries[end++])
  return { start, end, older: start, newer: entries.length - end }
}

export function scrolledTop(entries: readonly Activity[], top: number | undefined, by: number, rows: number): number | undefined {
  const last = lastPageTop(entries, rows)
  const next = Math.max(0, Math.min(last, (top ?? last) + by))
  return next >= last ? undefined : next
}

function lastPageTop(entries: readonly Activity[], rows: number): number {
  let start = entries.length
  let used = 0
  while (start > 0 && (start === entries.length || used + entryRows(entries[start - 1]) <= rows)) used += entryRows(entries[--start])
  return start
}

function entryRows(entry: Activity): number {
  return activityDetail(entry) === undefined ? 1 : 2
}
