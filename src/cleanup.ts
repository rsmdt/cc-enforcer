export const CLEANUP_COMMAND = 'cc-enforcer-cleanup'
export const DEFAULT_RETENTION_DAYS = 180
export const CLEANUP_HINT = '[period, e.g. last week, 30 days]'
export const CLEANUP_USAGE = `Usage: /${CLEANUP_COMMAND} [period], for example: last week, 30 days, 6 months, 90d. Without a period it removes logs older than ${DEFAULT_RETENTION_DAYS} days.`

const DAY_MS = 24 * 60 * 60 * 1000
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365, d: 1, w: 7, m: 30, y: 365 }
const PERIOD = /^(?:last\s+(day|week|month|year)|(\d+)\s*(day|week|month|year|d|w|m|y)s?)$/

export type CleanupIo = {
  list(dir: string): Promise<ReadonlyArray<{ name: string; kind: string }>>
  modifiedAt(path: string): Promise<number>
  confirm(question: string): Promise<boolean>
  remove(paths: string[]): Promise<void>
}

export function parsePeriod(args: string): number | undefined {
  const text = args.trim().toLowerCase()
  if (text === '') return DEFAULT_RETENTION_DAYS
  const match = PERIOD.exec(text)
  if (match === null) return undefined
  if (match[1] !== undefined) return UNIT_DAYS[match[1]]
  const count = Number(match[2])
  return count > 0 ? count * UNIT_DAYS[match[3]] : undefined
}

export async function cleanupLogs(io: CleanupIo, root: string, currentLog: string, days: number, now: number): Promise<string> {
  const cutoff = now - days * DAY_MS
  const logs = [...(await logFiles(io, `${root}/logs`)), ...(await projectLogs(io, `${root}/projects`))]
  const old: string[] = []
  for (const path of logs) {
    if (path !== currentLog && (await io.modifiedAt(path).catch(() => now)) < cutoff) old.push(path)
  }
  old.sort()
  const what = `${old.length} session ${old.length === 1 ? 'log' : 'logs'} older than ${days} days`
  if (old.length === 0) return `No session logs are older than ${days} days.`
  if (!(await io.confirm(`Delete ${what}? They hold the commands, prompts and file content cc-enforcer recorded.`))) return 'Nothing was deleted.'
  await io.remove(old)
  return `Deleted ${what}.`
}

async function projectLogs(io: CleanupIo, projects: string): Promise<string[]> {
  const folders = (await io.list(projects).catch(() => [])).filter((entry) => entry.kind === 'dir')
  return (await Promise.all(folders.map((folder) => logFiles(io, `${projects}/${folder.name}`)))).flat()
}

async function logFiles(io: CleanupIo, dir: string): Promise<string[]> {
  return (await io.list(dir).catch(() => [])).filter((entry) => entry.kind === 'file' && entry.name.endsWith('.jsonl')).map((entry) => `${dir}/${entry.name}`)
}
