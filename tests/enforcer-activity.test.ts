import { expect, test } from 'claude-code/testing'
import { stubMods, type ModSetup } from './fake-io.ts'
import { cardRowCount, createActivity, logWindow, scrolledTop, statCards } from '../src/activity.ts'

const forcePush = '---\nname: no-force-push\nevent: bash\naction: block\npattern: git push .*--force\n---\nNever force-push.\n'
const askDeploy = '---\nname: ask-deploy\nevent: bash\naction: ask\npattern: deploy\n---\nConfirm deploys.\n'
const rmWarning = '---\nname: careful-rm\nevent: bash\naction: warn\npattern: rm -rf\n---\nPrefer trash-cli.\n'
const reviewedRm = '---\nname: reviewed-rm\nevent: bash\naction: warn\nconditions:\n  - field: command\n    operator: contains\n    pattern: rm src\n  - field: command\n    operator: llm_evaluate\n    pattern: Does this delete source files?\n---\nKeep source files.\n'

const PANE_ID = 'cc-enforcer-audit'
const PANE_COMMAND = 'cc-enforcer-audit'
const PANE_PROPS = { title: 'cc-enforcer', isFocused: false, bodyColumns: 100, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} }

function setup(extra: Partial<ModSetup> = {}): ModSetup {
  return {
    files: {
      '/repo/.claude/hookify.no-force-push.local.md': forcePush,
      '/repo/.claude/hookify.ask-deploy.local.md': askDeploy,
      '/repo/.claude/hookify.careful-rm.local.md': rmWarning,
      '/repo/.claude/hookify.reviewed-rm.local.md': reviewedRm,
    },
    cwd: '/repo',
    dirs: ['/repo/.git'],
    surfaces: ['terminal'],
    ...extra,
  }
}

function bash($, id: string, command: string) {
  return $.tool.call({ tool: 'Bash', command, tool_use_id: id })
}

function row($, id: string, command: string) {
  const props = { tool_use_id: id, tool: 'Bash', input: { command }, isRunning: false, isErrored: false, isInterrupted: false }
  return $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'ToolUse', requestId: id, props })
}

function pane($, bodyColumns = PANE_PROPS.bodyColumns, bodyRows = PANE_PROPS.scroll.bodyRows) {
  return $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: { ...PANE_PROPS, bodyColumns, scroll: { offset: 0, bodyRows } } })
}

function turnComplete($) {
  return $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'turn-1', reason: 'answer' })
}

test('a blocked call row carries a badge naming the rule and the reason', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'git push origin main --force')
  const ui = await row($, 'tu-1', 'git push origin main --force')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer: blocked/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /no-force-push.*Never force-push\./s })).toBeDefined()
})

test('an approved call row carries an approved badge', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  const ui = await row($, 'tu-1', 'ls')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer: approved/ })).toBeDefined()
})

test('an ask the user denied shows as rejected with the rule reason', async ($, on) => {
  stubMods(on, setup({ answerAsk: async () => 'Deny' }))
  await bash($, 'tu-1', 'npm run deploy')
  const ui = await row($, 'tu-1', 'npm run deploy')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer: denied by you/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Confirm deploys\./ })).toBeDefined()
})

test('an ask the user allowed shows as allowed by the user', async ($, on) => {
  stubMods(on, setup({ answerAsk: async () => 'Allow' }))
  await bash($, 'tu-1', 'npm run deploy')
  const ui = await row($, 'tu-1', 'npm run deploy')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer: allowed by you/ })).toBeDefined()
})

test('a warned call row shows the finding', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'rm -rf build')
  const ui = await row($, 'tu-1', 'rm -rf build')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer: warned.*Prefer trash-cli\./s })).toBeDefined()
})

test('a call waiting for the turn-end review shows as queued, then as flagged with the finding', async ($, on) => {
  const complete = async () => ({ isAnswered: true, text: JSON.stringify([{ ruleId: 'project:reviewed-rm', toolUseId: 'tu-1', finding: 'deletes src/a.ts' }]) })
  stubMods(on, setup({ complete }))
  await bash($, 'tu-1', 'rm src/a.ts')
  const queued = await row($, 'tu-1', 'rm src/a.ts')
  expect(await queued.find({ type: 'Text', text: /cc-enforcer: queued for review/ })).toBeDefined()
  await queued.unmount()
  await turnComplete($)
  expect(await (await row($, 'tu-1', 'rm src/a.ts')).find({ type: 'Text', text: /cc-enforcer: flagged.*deletes src\/a\.ts/s })).toBeDefined()
})

test('a queued call the review did not flag shows as approved after the review', async ($, on) => {
  stubMods(on, setup({ complete: async () => ({ isAnswered: true, text: '[]' }) }))
  await bash($, 'tu-1', 'rm src/a.ts')
  await turnComplete($)
  expect(await (await row($, 'tu-1', 'rm src/a.ts')).find({ type: 'Text', text: /cc-enforcer: approved/ })).toBeDefined()
})

test('a call no rule covers gets no badge', async ($, on) => {
  stubMods(on, setup())
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts', tool_use_id: 'tu-1' })
  const ui = await row($, 'tu-1', '')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer/ })).toBeUndefined()
})

test('a row cc-enforcer never checked is drawn unchanged', async ($, on) => {
  stubMods(on, setup())
  const ui = await row($, 'tu-unknown', 'ls')
  expect(await ui.find({ type: 'Text', text: /cc-enforcer/ })).toBeUndefined()
})

test('the audit command opens the pane and running it again closes it', async ($, on) => {
  const mods = stubMods(on, setup())
  await $.session.start({})
  expect(mods.commands).toContain(PANE_COMMAND)
  await $.command.run({ command: PANE_COMMAND, args: '' })
  expect(mods.panes.map((open) => open.id)).toEqual([PANE_ID])
  await $.command.run({ command: PANE_COMMAND, args: '' })
  expect(mods.panes).toEqual([])
})

type Cell = { text: string; color: unknown }

function cell(child: any): Cell {
  const text = child.type === 'Box' ? child.children[0] : child
  return { text: text.children.join(''), color: text.props?.color ?? (text.props?.dimColor ? 'dim' : undefined) }
}

async function paneRow(ui, index: number): Promise<{ time: Cell; icon: Cell; what: Cell; detail: Cell | undefined }> {
  const [time, icon, what] = (await ui.find({ key: `row:${index}` })).children.map(cell)
  const under = await ui.find({ key: `detail:${index}` })
  return { time, icon, what, detail: under === undefined ? undefined : cell(under.children[0]) }
}

const KINDS = ['approved', 'rejected', 'cautioned', 'pending', 'ignored']

async function card(ui, kind: string): Promise<string[]> {
  return (await ui.find({ key: `card:${kind}` })).children.map((child) => cell(child).text)
}

async function counts(ui): Promise<Record<string, string>> {
  const entries = await Promise.all(KINDS.map(async (kind) => [kind, (await card(ui, kind))[1].replace(/[│ ]/g, '')]))
  return Object.fromEntries(entries)
}

async function checked(ui): Promise<string> {
  return (await card(ui, 'checked'))[1].replace(/[│ ]/g, '')
}

test('the status line under the prompt keeps the session counts current', async ($, on) => {
  const mods = stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'git push origin main --force')
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts', tool_use_id: 'tu-3' })
  expect(mods.statuses.at(-1)).toBe('#2 ✓1 ✗1 !0 …0 ·1')
})

test('the audit pane asks the dock for the width the labelled stat cards need', async ($, on) => {
  const mods = stubMods(on, setup())
  await $.session.start({})
  await $.command.run({ command: PANE_COMMAND, args: '' })
  expect(mods.panes).toEqual([{ id: PANE_ID, title: 'cc-enforcer audit', columns: 87 }])
})

test('each pane row reads time, icon and operation, with the status and rejection reason beneath', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'git push origin main --force')
  await $.tool.call({ tool: 'Write', file_path: '/repo/src/a.ts', content: 'x', tool_use_id: 'tu-3' })
  const ui = await pane($)
  const first = await paneRow(ui, 0)
  expect(first.time.text).toMatch(/^\d\d:\d\d:\d\d$/)
  expect(first.icon.text).toBe('✓')
  expect(first.what.text).toBe('Bash ls')
  expect(first.detail).toBeUndefined()
  const second = await paneRow(ui, 1)
  expect(second.icon.text).toBe('✗')
  expect(second.what.text).toBe('Bash git push origin main --force')
  expect(second.detail.text).toMatch(/blocked — \[cc-enforcer:project:no-force-push\] Never force-push\./)
  expect((await paneRow(ui, 2)).what.text).toBe('Write /repo/src/a.ts')
})

test('each pane row is coloured by its outcome, like a log level', async ($, on) => {
  stubMods(on, setup({ complete: () => new Promise(() => undefined) }))
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'git push origin main --force')
  await bash($, 'tu-3', 'rm -rf build')
  await bash($, 'tu-4', 'rm src/a.ts')
  const ui = await pane($)
  const colours = await Promise.all([0, 1, 2, 3].map(async (index) => (await paneRow(ui, index)).icon.color))
  expect(colours).toEqual(['success', 'error', 'warning', 'suggestion'])
  expect((await paneRow(ui, 1)).detail.color).toBe('error')
  expect((await paneRow(ui, 2)).detail.color).toBe('warning')
})

test('the pane heading counts this session\'s checks by outcome', async ($, on) => {
  stubMods(on, setup({ answerAsk: async () => 'Deny', complete: () => new Promise(() => undefined) }))
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'pwd')
  await bash($, 'tu-3', 'git push origin main --force')
  await bash($, 'tu-4', 'npm run deploy')
  await bash($, 'tu-5', 'rm -rf build')
  await bash($, 'tu-6', 'rm src/a.ts')
  const ui = await pane($)
  expect(await checked(ui)).toBe('6')
  expect(await counts(ui)).toEqual({ approved: '2', rejected: '2', cautioned: '1', pending: '1', ignored: '0' })
})

test('on a wide pane each stat card carries its label in the top border and the count alone in the middle', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'pwd')
  const ui = await pane($, 100)
  expect(await card(ui, 'checked')).toEqual(['╭─ checked ─╮', '│     2     │', '╰───────────╯'])
  expect(await card(ui, 'approved')).toEqual(['╭─ approved ─╮', '│     2      │', '╰────────────╯'])
  expect(await card(ui, 'ignored')).toEqual(['╭─ ignored ─╮', '│     0     │', '╰───────────╯'])
  expect((await ui.find({ key: 'card:rejected' })).children[0].props.color).toBe('error')
})

test('on a pane too narrow for the labelled cards the label gives way to the icon', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'pwd')
  const ui = await pane($, 50)
  expect(await card(ui, 'checked')).toEqual(['╭─ # ─╮', '│  2  │', '╰─────╯'])
  expect(await card(ui, 'approved')).toEqual(['╭─ ✓ ─╮', '│  2  │', '╰─────╯'])
  expect(await card(ui, 'pending')).toEqual(['╭─ … ─╮', '│  0  │', '╰─────╯'])
})

test('the pane lists calls no rule covers dimmed, and the heading counts them apart from the checked ones', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts', tool_use_id: 'tu-2' })
  const ui = await pane($)
  const uncovered = await paneRow(ui, 1)
  expect(uncovered.icon).toEqual({ text: '·', color: 'dim' })
  expect(uncovered.what).toEqual({ text: 'Read /repo/a.ts', color: 'dim' })
  expect(uncovered.detail).toBeUndefined()
  expect(await checked(ui)).toBe('1')
  expect(await counts(ui)).toEqual({ approved: '1', rejected: '0', cautioned: '0', pending: '0', ignored: '1' })
})

test('a call a file rule covers is approved, not uncovered', async ($, on) => {
  const fileRule = '---\nname: no-env\nevent: file\naction: block\npattern: \\.env$\n---\nKeep secrets out.\n'
  stubMods(on, setup({ files: { '/repo/.claude/hookify.no-env.local.md': fileRule } }))
  await $.tool.call({ tool: 'Write', file_path: '/repo/src/a.ts', content: 'x', tool_use_id: 'tu-1' })
  expect(await (await row($, 'tu-1', '')).find({ type: 'Text', text: /cc-enforcer: approved/ })).toBeDefined()
})

test('the pane shows a queued soft-rule check as in progress until the turn-end review settles it', async ($, on) => {
  let finish: (value: unknown) => void = () => undefined
  const complete = () => new Promise((resolve) => (finish = resolve))
  stubMods(on, setup({ complete }))
  await bash($, 'tu-1', 'rm src/a.ts')
  const queued = await pane($)
  expect((await paneRow(queued, 0)).detail.text).toBe('queued for review')
  await queued.unmount()
  const reviewing = turnComplete($)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const during = await pane($)
  expect((await paneRow(during, 0)).detail.text).toBe('reviewing')
  await during.unmount()
  finish({ isAnswered: true, text: '[]' })
  await reviewing
  const done = await paneRow(await pane($), 0)
  expect(done.icon.text).toBe('✓')
  expect(done.detail).toBeUndefined()
})

test('the empty pane says nothing has been checked yet', async ($, on) => {
  stubMods(on, setup())
  const ui = await pane($)
  expect(await ui.find({ type: 'Text', text: 'CC Enforcer' })).toMatchObject({ props: { bold: true } })
  expect(await checked(ui)).toBe('0')
  expect(await counts(ui)).toEqual({ approved: '0', rejected: '0', cautioned: '0', pending: '0', ignored: '0' })
  expect(await ui.find({ type: 'Text', text: /No calls checked yet/ })).toBeDefined()
})

test('the pane leaves other panes to their own plugins', async ($, on) => {
  stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  const ui = await $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'Pane', requestId: 'someone-else', props: PANE_PROPS })
  expect(await ui.find({ type: 'Text', text: /approved/ })).toBeUndefined()
})

function group($, ids: string[]) {
  const calls = ids.map((id) => ({ tool_use_id: id, tool: 'Bash', input: {}, isRunning: false, isErrored: false }))
  const props = { calls, isActive: false, isExpanded: false }
  return $.ui.mount({ plugin: 'cc-enforcer', surface: 'terminal', component: 'ToolGroup', props })
}

test('a folded group unfolds when cc-enforcer rejected one of its calls, so the badge shows', async ($, on) => {
  const mods = stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'git push origin main --force')
  await group($, ['tu-1', 'tu-2'])
  expect(mods.rendered.filter((render) => render.component === 'ToolGroup').map((render) => render.props.isExpanded)).toEqual([true])
})

test('a folded group of approved calls stays folded', async ($, on) => {
  const mods = stubMods(on, setup())
  await bash($, 'tu-1', 'ls')
  await bash($, 'tu-2', 'pwd')
  await group($, ['tu-1', 'tu-2'])
  expect(mods.rendered.filter((render) => render.component === 'ToolGroup').map((render) => render.props.isExpanded)).toEqual([false])
})

test('a log longer than the pane shows its newest rows under the fixed header and counts the older ones', async ($, on) => {
  stubMods(on, setup())
  for (let index = 0; index < 10; index++) await bash($, `tu-${index}`, `echo ${index}`)
  const ui = await pane($, 100, 9)
  expect(await ui.find({ type: 'Text', text: 'CC Enforcer' })).toBeDefined()
  expect(await ui.find({ key: 'card:checked' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Log · 10 events\s+↑ 7 older$/ })).toBeDefined()
  expect(await ui.find({ key: 'row:6' })).toBeUndefined()
  expect(await Promise.all([7, 8, 9].map(async (index) => (await ui.find({ key: `row:${index}` })) !== undefined))).toEqual([true, true, true])
})

function filledLog(statuses: Array<'approved' | 'blocked'>) {
  const log = createActivity()
  statuses.forEach((status, index) => {
    log.start(`tu-${index}`, 'main', 'Bash', `echo ${index}`)
    log.settle(`tu-${index}`, status, status === 'blocked' ? 'no' : undefined)
  })
  return log.list()
}

test('the log window fits rows, counting a rejection reason as a second row', () => {
  const entries = filledLog(['approved', 'blocked', 'approved', 'blocked', 'approved'])
  expect(logWindow(entries, undefined, 4)).toEqual({ start: 2, end: 5, older: 2, newer: 0 })
  expect(logWindow(entries, 0, 4)).toEqual({ start: 0, end: 3, older: 0, newer: 2 })
})

test('scrolling up leaves the newest rows and scrolling back to the end follows new ones again', () => {
  const entries = filledLog(['approved', 'approved', 'approved', 'approved', 'approved', 'approved'])
  expect(scrolledTop(entries, undefined, -2, 3)).toBe(1)
  expect(scrolledTop(entries, 1, -5, 3)).toBe(0)
  expect(scrolledTop(entries, 1, 1, 3)).toBe(2)
  expect(scrolledTop(entries, 1, 2, 3)).toBeUndefined()
})

test('the header knows how many rows of cards it takes at a width', () => {
  const totals = { approved: 0, rejected: 0, cautioned: 0, pending: 0, ignored: 0 }
  expect(cardRowCount(statCards(totals, 100), 100)).toBe(1)
  expect(cardRowCount(statCards(totals, 30), 30)).toBe(2)
})
