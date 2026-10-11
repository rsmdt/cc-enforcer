import { expect, test } from 'claude-code/testing'
import { MODS_OFF_GUIDANCE } from '../src/commands.ts'
import { HOOKIFY_NOTICE } from '../src/recorder.ts'
import { stubMods } from './fake-io.ts'

const forcePush = (extra = '') => `---\n${extra}event: bash\naction: block\npattern: git push .*--force\n---\nNever force-push.\n`
const migrations = '---\nevent: file\naction: warn\nconditions:\n  - field: new_text\n    operator: llm_evaluate\n    pattern: Does this change an existing migration?\n---\nAdd a new migration.\n'
const projectRule = '/repo/.claude/hookify.no-force-push.local.md'
const personalRule = '/home/u/.claude/hookify.no-force-push.local.md'

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function run($, command: string, args = '') {
  const result = await $.command.run({ command, args })
  return result.text as string
}

test('the overview lists name, event, action, evaluator, source, on/off and hits for each rule', async ($, on) => {
  stubMods(on, {
    files: {
      [projectRule]: forcePush(),
      '/repo/.claude/hookify.migrations.local.md': migrations,
      '/home/u/.claude/hookify.no-sudo.local.md': forcePush('enabled: false\n'),
    },
    cwd: '/repo',
    dirs: ['/repo/.git'],
  })
  await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  await $.tool.call({ tool: 'Bash', command: 'git push origin main --force' })
  await settled()
  const text = await run($, 'cc-enforcer-rules')
  const rows = text.split('\n').filter((line) => line.startsWith('  '))
  expect(rows).toEqual([
    '  migrations  event: file  action: warn  evaluator: yes  source: project  on  hits: 0',
    '  no-force-push  event: bash  action: block  evaluator: no  source: project  on  hits: 2',
    '  no-sudo  event: bash  action: block  evaluator: no  source: personal  off  hits: 0',
  ])
})

test('an empty overview says no rules are active and names the project and personal folders', async ($, on) => {
  stubMods(on, { files: {}, cwd: '/repo/app', dirs: ['/repo/.git'] })
  const text = await run($, 'cc-enforcer-rules')
  expect(text).toContain('No rules are active')
  expect(text).toContain('/repo/app/.claude')
  expect(text).toContain('/home/u/.claude')
})

test('the overview points to Claude Code mods-off signals and /reload-plugins', async ($, on) => {
  stubMods(on, { files: { [projectRule]: forcePush() }, cwd: '/repo', dirs: ['/repo/.git'] })
  const text = await run($, 'cc-enforcer-rules')
  expect(text).toContain(MODS_OFF_GUIDANCE)
  expect(MODS_OFF_GUIDANCE).toContain('mods active')
  expect(MODS_OFF_GUIDANCE).toContain('/plugin')
  expect(MODS_OFF_GUIDANCE).toContain('/reload-plugins')
  expect(MODS_OFF_GUIDANCE).toContain('transcript')
})

test('switching a rule off writes enabled: false and later calls are not checked against it', async ($, on) => {
  const files = { [projectRule]: forcePush() }
  const mods = stubMods(on, { files, cwd: '/repo', dirs: ['/repo/.git'] })
  expect((await $.tool.call({ tool: 'Bash', command: 'git push --force' })).deny).toMatch(/no-force-push/)
  const reply = await run($, 'cc-enforcer-toggle', 'no-force-push off')
  expect(reply).toContain('project:no-force-push off')
  expect(files[projectRule]).toBe(forcePush('enabled: false\n'))
  expect((await $.tool.call({ tool: 'Bash', command: 'git push --force' })).result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
  expect(await run($, 'cc-enforcer-rules')).toContain('source: project  off')
})

test('switching an unknown rule changes nothing and says why', async ($, on) => {
  const files = { [projectRule]: forcePush() }
  const mods = stubMods(on, { files, cwd: '/repo', dirs: ['/repo/.git'] })
  const reply = await run($, 'cc-enforcer-toggle', 'nope off')
  expect(reply).toContain('No rule named "nope"')
  expect(reply).toContain('nothing was changed')
  expect([...mods.writes.keys()].filter((path) => path.endsWith('.local.md'))).toEqual([])
})

test('a name in both folders needs a source; with one, only that file is switched', async ($, on) => {
  const files = { [projectRule]: forcePush(), [personalRule]: forcePush() }
  stubMods(on, { files, cwd: '/repo', dirs: ['/repo/.git'] })
  const ambiguous = await run($, 'cc-enforcer-toggle', 'no-force-push off')
  expect(ambiguous).toContain('both the project and the personal folder')
  expect(ambiguous).toContain('nothing was changed')
  expect(files[personalRule]).toBe(forcePush())
  await run($, 'cc-enforcer-toggle', 'no-force-push off personal')
  expect(files[personalRule]).toBe(forcePush('enabled: false\n'))
  expect(files[projectRule]).toBe(forcePush())
})

test('a malformed toggle shows the usage and changes nothing', async ($, on) => {
  const files = { [projectRule]: forcePush() }
  stubMods(on, { files, cwd: '/repo', dirs: ['/repo/.git'] })
  expect(await run($, 'cc-enforcer-toggle', 'no-force-push maybe')).toContain('Usage: /cc-enforcer-toggle <name> on|off [project|personal]')
  expect(files[projectRule]).toBe(forcePush())
})

test('every command is registered at session start', async ($, on) => {
  const mods = stubMods(on, { files: {}, cwd: '/repo', dirs: ['/repo/.git'] })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo' })
  expect(mods.commands).toEqual(['cc-enforcer-rules', 'cc-enforcer-toggle', 'cc-enforcer-audit', 'cc-enforcer-cleanup'])
})

test('a session start with Hookify enabled tells the user to disable Hookify', async ($, on) => {
  const mods = stubMods(on, { files: {}, cwd: '/repo', dirs: ['/repo/.git'], settings: { enabledPlugins: { 'hookify@claude-plugins-official': true } } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo' })
  expect(mods.userLines).toContain(HOOKIFY_NOTICE)
  expect(HOOKIFY_NOTICE).toContain('same rule files')
  expect(HOOKIFY_NOTICE).toContain('Disable Hookify')
})

test('a session start without Hookify enabled says nothing about it', async ($, on) => {
  const mods = stubMods(on, { files: {}, cwd: '/repo', dirs: ['/repo/.git'], settings: { enabledPlugins: { 'hookify@claude-plugins-official': false, 'other@x': true } } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo' })
  expect(mods.userLines).not.toContain(HOOKIFY_NOTICE)
})

test('a command that cannot finish says so and changes nothing', async ($, on) => {
  const files = { [projectRule]: forcePush() }
  stubMods(on, { files, cwd: '/repo', dirs: ['/repo/.git'], failing: ['session.cwd'] })
  expect(await run($, 'cc-enforcer-toggle', 'no-force-push off')).toBe('cc-enforcer: the command could not finish; no rule file was changed')
  expect(files[projectRule]).toBe(forcePush())
})
