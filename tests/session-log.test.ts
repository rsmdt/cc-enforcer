import { expect, test } from 'claude-code/testing'
import { sessionLog, sessionLogPath, stubMods, type ModSetup } from './fake-io.ts'

const blockedPush = '---\nname: no-force-push\nevent: bash\naction: block\npattern: git push .*--force\n---\nNever force-push.\n'
const reviewedRm = '---\nname: reviewed-rm\nevent: bash\naction: warn\nconditions:\n  - field: command\n    operator: contains\n    pattern: rm src\n  - field: command\n    operator: llm_evaluate\n    pattern: Does this delete source files?\n---\nKeep source files.\n'
const unfinished = '---\nname: finish-the-tests\nevent: stop\naction: block\npattern: TODO run tests\n---\nRun the test suite before you stop.\n'

const LOG = sessionLogPath('/repo')
const PANE_ID = 'cc-enforcer-audit'
const CLEANUP = 'cc-enforcer-cleanup'
const DAY = 24 * 60 * 60 * 1000
const PANE_PROPS = { title: 'cc-enforcer', isFocused: false, bodyColumns: 100, placement: 'inline', scroll: { offset: 0, bodyRows: 40 }, view: {} }

function setup(extra: Partial<ModSetup> = {}): ModSetup {
  return {
    cwd: '/repo',
    dirs: ['/repo/.git'],
    surfaces: ['terminal'],
    ...extra,
    files: {
      '/repo/.claude/hookify.no-force-push.local.md': blockedPush,
      '/repo/.claude/hookify.reviewed-rm.local.md': reviewedRm,
      '/repo/.claude/hookify.finish-the-tests.local.md': unfinished,
      ...extra.files,
    },
  }
}

async function settled() {
  for (let tick = 0; tick < 5; tick++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function bash($, id: string, command: string) {
  return $.tool.call({ tool: 'Bash', command, tool_use_id: id })
}

function lastState(lines: any[], id: string) {
  return lines.filter((line) => line.kind === 'activity' && line.id === id).at(-1)
}

test('every tool call is logged with its full input and the rules covering and matching it, including calls no rule covers', async ($, on) => {
  const mods = stubMods(on, setup())
  await bash($, 'tu-1', 'ls -la')
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts', tool_use_id: 'tu-2' })
  await bash($, 'tu-3', 'git push origin main --force')
  await settled()
  const lines = sessionLog(mods.writes)
  expect(lastState(lines, 'tu-1')).toMatchObject({ tool: 'Bash', input: { command: 'ls -la' }, status: 'approved', covering: ['project:no-force-push', 'project:reviewed-rm'], matched: [] })
  expect(lastState(lines, 'tu-2')).toMatchObject({ tool: 'Read', input: { file_path: '/repo/a.ts' }, status: 'ignored', covering: [], matched: [] })
  expect(lastState(lines, 'tu-3')).toMatchObject({ status: 'blocked', matched: ['project:no-force-push'], reason: '[cc-enforcer:project:no-force-push] Never force-push.' })
  expect(typeof lastState(lines, 'tu-3').started).toBe('string')
})

test('each status change of a call is logged in the order it happened', async ($, on) => {
  const mods = stubMods(on, setup({ complete: async () => ({ isAnswered: true, text: '[]' }) }))
  await bash($, 'tu-1', 'rm src/a.ts')
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'turn-1', reason: 'answer' })
  await settled()
  const statuses = sessionLog(mods.writes).filter((line) => line.kind === 'activity' && line.id === 'tu-1').map((line) => line.status)
  expect(statuses).toEqual(['checking', 'approved', 'queued for review', 'reviewing', 'approved'])
})

test('every prompt is logged with its text and outcome, even when no rule applies', async ($, on) => {
  const mods = stubMods(on, setup())
  await $.prompt.submit({ text: 'tidy the README', wait: false, origin: { kind: 'composer' } })
  await settled()
  expect(sessionLog(mods.writes).filter((line) => line.kind === 'prompt')).toMatchObject([{ text: 'tidy the README', outcome: 'pass', ruleIds: [] }])
})

test('every turn end is logged with its outcome and the rules that applied', async ($, on) => {
  const mods = stubMods(on, setup({ files: { '/home/u/a.jsonl': '{"text":"TODO run tests"}\n', '/home/u/b.jsonl': '{"text":"All green."}\n' } }))
  await $.classic.Stop({ stop_hook_active: false, transcript_path: '/home/u/a.jsonl', last_assistant_message: 'TODO run tests' })
  await $.classic.Stop({ stop_hook_active: false, transcript_path: '/home/u/b.jsonl', last_assistant_message: 'All green.' })
  await settled()
  const turnEnds = sessionLog(mods.writes).filter((line) => line.kind === 'turn-end')
  expect(turnEnds.map((line) => [line.agentLabel, line.outcome, line.ruleIds])).toEqual([
    ['main session', 'block', ['project:finish-the-tests']],
    ['main session', 'pass', []],
  ])
})

function oldLog(): string {
  const started = new Date(2026, 9, 1, 8, 15, 30).toISOString()
  const lines = [
    { kind: 'activity', id: 'tu-old-1', queue: 'main', tool: 'Bash', operation: 'git push origin main --force', input: { command: 'git push origin main --force' }, status: 'blocked', reason: 'Never force-push.', covering: [], matched: [], started, time: started },
    { kind: 'block', ruleId: 'project:no-force-push', ruleName: 'no-force-push', action: 'block', tool: 'Bash', time: started },
    { kind: 'activity', id: 'tu-old-2', queue: 'main', tool: 'Bash', operation: 'ls', input: { command: 'ls' }, status: 'checking', covering: [], matched: [], started, time: started },
    { kind: 'activity', id: 'tu-old-2', queue: 'main', tool: 'Bash', operation: 'ls', input: { command: 'ls' }, status: 'approved', covering: [], matched: [], started, time: started },
  ]
  return lines.map((line) => JSON.stringify(line)).join('\n') + '\n'
}

test('a resumed session restores the audit pane, with the original times, and the hit counts from its log', async ($, on) => {
  const mods = stubMods(on, setup({ files: { [LOG]: oldLog() } }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: PANE_PROPS })
  const first = (await ui.find({ key: 'row:0' })).children
  expect(first[0].children[0].children.join('')).toBe('08:15:30')
  expect(first[2].children.join('')).toBe('Bash git push origin main --force')
  expect((await ui.find({ key: 'row:1' })).children[2].children.join('')).toBe('Bash ls')
  expect((await ui.find({ key: 'card:rejected' })).children[1].children.join('')).toContain('1')
  expect((await ui.find({ key: 'card:approved' })).children[1].children.join('')).toContain('1')
  expect(mods.statuses.at(-1)).toBe('#2 ✓1 ✗1 !0 …0 ·0')
  const overview = await $.command.run({ command: 'cc-enforcer-rules', args: '' })
  expect(overview.text).toMatch(/no-force-push.*hits: 1/)
})

test('a call still in progress when the earlier session ended is restored as not reviewed', async ($, on) => {
  const started = new Date(2026, 9, 1, 9, 0, 0).toISOString()
  const unfinished = JSON.stringify({ kind: 'activity', id: 'tu-cut', queue: 'main', tool: 'Bash', operation: 'rm src/a.ts', status: 'queued for review', started, time: started }) + '\n'
  stubMods(on, setup({ files: { [LOG]: unfinished } }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: PANE_PROPS })
  expect((await ui.find({ key: 'detail:0' })).children[0].children.join('')).toBe('not reviewed')
  expect((await ui.find({ key: 'card:pending' })).children[1].children.join('')).toContain('0')
})

test('a resumed log keeps its earlier lines and new events are added after them, even without a session start', async ($, on) => {
  const mods = stubMods(on, setup({ files: { [LOG]: oldLog() } }))
  await bash($, 'tu-new', 'pwd')
  await settled()
  const text = mods.writes.get(LOG) ?? ''
  expect(text.startsWith(oldLog())).toBe(true)
  expect(lastState(sessionLog(mods.writes), 'tu-new')).toMatchObject({ status: 'approved', input: { command: 'pwd' } })
})

function aged(now: number) {
  return {
    files: {
      [LOG]: oldLog(),
      '/home/u/.cc-enforcer/projects/-repo/old.jsonl': '{}\n',
      '/home/u/.cc-enforcer/projects/-other/recent.jsonl': '{}\n',
      '/home/u/.cc-enforcer/logs/legacy.jsonl': '{}\n',
    },
    mtimes: {
      [LOG]: now - 300 * DAY,
      '/home/u/.cc-enforcer/projects/-repo/old.jsonl': now - 200 * DAY,
      '/home/u/.cc-enforcer/projects/-other/recent.jsonl': now - 10 * DAY,
      '/home/u/.cc-enforcer/logs/legacy.jsonl': now - 400 * DAY,
    },
  }
}

function removals(steps: string[]): string[] {
  return steps.filter((step) => step.startsWith('run rm '))
}

test('cleanup is a registered command', async ($, on) => {
  const mods = stubMods(on, setup())
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  expect(mods.commands).toContain(CLEANUP)
})

test('cleanup without a period removes session logs older than 180 days after the user confirms, never the current one', async ($, on) => {
  const mods = stubMods(on, setup({ ...aged(Date.now()), answerAsk: async () => 'Delete' }))
  const result = await $.command.run({ command: CLEANUP, args: '' })
  expect(mods.asked[0].question).toContain('2 session logs older than 180 days')
  expect(removals(mods.logFileSteps)).toEqual(['run rm -f /home/u/.cc-enforcer/logs/legacy.jsonl /home/u/.cc-enforcer/projects/-repo/old.jsonl'])
  expect(result.text).toBe('Deleted 2 session logs older than 180 days.')
})

test('cleanup takes a period such as last week', async ($, on) => {
  const mods = stubMods(on, setup({ ...aged(Date.now()), answerAsk: async () => 'Delete' }))
  const result = await $.command.run({ command: CLEANUP, args: 'last week' })
  expect(removals(mods.logFileSteps)).toEqual([
    'run rm -f /home/u/.cc-enforcer/logs/legacy.jsonl /home/u/.cc-enforcer/projects/-other/recent.jsonl /home/u/.cc-enforcer/projects/-repo/old.jsonl',
  ])
  expect(result.text).toBe('Deleted 3 session logs older than 7 days.')
})

test('cleanup reads periods in days, weeks, months and years', async ($, on) => {
  const mods = stubMods(on, setup({ ...aged(Date.now()), answerAsk: async () => 'Keep' }))
  for (const [args, days] of [['30 days', 30], ['2 weeks', 14], ['6 months', 180], ['1 year', 365], ['90d', 90], ['last month', 30]] as const) {
    const result = await $.command.run({ command: CLEANUP, args })
    expect(result.text).toBe('Nothing was deleted.')
    expect(mods.asked.at(-1)?.question ?? '').toContain(`older than ${days} days`)
  }
})

test('cleanup deletes nothing when the user keeps the logs', async ($, on) => {
  const mods = stubMods(on, setup({ ...aged(Date.now()), answerAsk: async () => 'Keep' }))
  const result = await $.command.run({ command: CLEANUP, args: '' })
  expect(removals(mods.logFileSteps)).toEqual([])
  expect(result.text).toBe('Nothing was deleted.')
})

test('cleanup with a period it cannot read shows how to use it and deletes nothing', async ($, on) => {
  const mods = stubMods(on, setup({ ...aged(Date.now()), answerAsk: async () => 'Delete' }))
  const result = await $.command.run({ command: CLEANUP, args: 'someday' })
  expect(mods.asked).toEqual([])
  expect(removals(mods.logFileSteps)).toEqual([])
  expect(result.text).toBe('Usage: /cc-enforcer-cleanup [period], for example: last week, 30 days, 6 months, 90d. Without a period it removes logs older than 180 days.')
})

test('cleanup with nothing old enough asks nothing', async ($, on) => {
  const now = Date.now()
  const mods = stubMods(on, setup({ files: { '/home/u/.cc-enforcer/projects/-other/recent.jsonl': '{}\n' }, mtimes: { '/home/u/.cc-enforcer/projects/-other/recent.jsonl': now - DAY }, answerAsk: async () => 'Delete' }))
  const result = await $.command.run({ command: CLEANUP, args: '' })
  expect(mods.asked).toEqual([])
  expect(result.text).toBe('No session logs are older than 180 days.')
})
