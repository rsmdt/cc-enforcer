import { expect, test } from 'claude-code/testing'
import { createRuleSources, type Rejection } from '../src/sources/index.ts'
import { fakeIo, stubMods } from './fake-io.ts'

const blockRule = (pattern: string) => `---\nevent: bash\naction: block\npattern: ${pattern}\n---\nUse something else.\n`
const invalidRule = '---\nevent: bash\naction: deny\npattern: x\n---\nb\n'
const rulePath = '/repo/.claude/hookify.guard.local.md'

function liveSources(files: Record<string, string>) {
  const rejections: Rejection[] = []
  const sources = createRuleSources()
  const io = fakeIo(files, { cwd: '/repo', home: '/home/u', dirs: ['/repo/.git', '/repo/.claude'] })
  const patterns = async () => (await sources.current(io, (rejection) => rejections.push(rejection))).map((rule) => rule.conditions[0].pattern)
  return { patterns, rejections }
}

test('a rule file added mid-session applies to the next check', async () => {
  const files: Record<string, string> = {}
  const live = liveSources(files)
  expect(await live.patterns()).toEqual([])
  files[rulePath] = blockRule('sudo')
  expect(await live.patterns()).toEqual(['sudo'])
})

test('a rule file changed mid-session applies its new content to the next check', async () => {
  const files: Record<string, string> = { [rulePath]: blockRule('sudo') }
  const live = liveSources(files)
  expect(await live.patterns()).toEqual(['sudo'])
  files[rulePath] = blockRule('rm -rf')
  expect(await live.patterns()).toEqual(['rm -rf'])
})

test('a rule file deleted mid-session stops applying at the next check', async () => {
  const files: Record<string, string> = { [rulePath]: blockRule('sudo') }
  const live = liveSources(files)
  expect(await live.patterns()).toEqual(['sudo'])
  delete files[rulePath]
  expect(await live.patterns()).toEqual([])
})

test('an invalid edit keeps the last valid version and is reported once as rejected', async () => {
  const files: Record<string, string> = { [rulePath]: blockRule('sudo') }
  const live = liveSources(files)
  expect(await live.patterns()).toEqual(['sudo'])
  files[rulePath] = invalidRule
  expect(await live.patterns()).toEqual(['sudo'])
  expect(await live.patterns()).toEqual(['sudo'])
  expect(live.rejections).toEqual([{ path: rulePath, source: 'project', problem: expect.stringMatching(/deny/), lastValidKept: true }])
})

test('a fixed edit after a rejected one applies the fixed version', async () => {
  const files: Record<string, string> = { [rulePath]: blockRule('sudo') }
  const live = liveSources(files)
  await live.patterns()
  files[rulePath] = invalidRule
  await live.patterns()
  files[rulePath] = blockRule('rm -rf')
  expect(await live.patterns()).toEqual(['rm -rf'])
})

test('a deleted rule does not come back when the file reappears invalid', async () => {
  const files: Record<string, string> = { [rulePath]: blockRule('sudo') }
  const live = liveSources(files)
  await live.patterns()
  delete files[rulePath]
  await live.patterns()
  files[rulePath] = invalidRule
  expect(await live.patterns()).toEqual([])
  expect(live.rejections.map((rejection) => rejection.lastValidKept)).toEqual([false])
})

test('an invalid edit mid-session tells the user once, even across concurrent calls, and the last valid rule still blocks', async ($, on) => {
  const path = '/live/.claude/hookify.no-sudo.local.md'
  const files: Record<string, string> = { [path]: blockRule('sudo') }
  const mods = stubMods(on, { files, cwd: '/live', dirs: ['/live/.git'] })
  expect((await $.tool.call({ tool: 'Bash', command: 'sudo ls' })).deny).toMatch(/no-sudo/)
  files[path] = invalidRule
  const results = await Promise.all([
    $.tool.call({ tool: 'Bash', command: 'sudo ls' }),
    $.tool.call({ tool: 'Bash', command: 'sudo rm' }),
  ])
  expect(results.map((result) => result.deny)).toEqual([expect.stringMatching(/no-sudo/), expect.stringMatching(/no-sudo/)])
  await $.tool.call({ tool: 'Bash', command: 'sudo ls' })
  const notices = mods.userLines.filter((line) => line.includes(path))
  expect(notices.length).toBe(1)
  expect(notices[0]).toMatch(/rejected/)
  expect(notices[0]).toMatch(/last valid version/)
})
