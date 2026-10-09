import { expect, test } from 'claude-code/testing'
import { createRuleSources } from '../src/sources/index.ts'
import { fakeIo } from './fake-io.ts'

const draftedRule = '---\nname: no-sudo\nevent: bash\naction: block\npattern: \\bsudo\\b\n---\nRun the command without sudo.\n'

function session(files: Record<string, string>) {
  const sources = createRuleSources()
  const io = fakeIo(files, { cwd: '/repo/app', home: '/home/u', dirs: ['/repo/.git', '/repo/app'] })
  return async () => (await sources.current(io, () => {})).map((rule) => rule.id)
}

test('a draft saved to a project .claude folder that did not exist applies to the next check', async () => {
  const files: Record<string, string> = {}
  const ruleIds = session(files)
  expect(await ruleIds()).toEqual([])
  files['/repo/app/.claude/hookify.no-sudo.local.md'] = draftedRule
  expect(await ruleIds()).toEqual(['project:no-sudo'])
})

test('a draft saved to a personal folder that did not exist applies to the next check', async () => {
  const files: Record<string, string> = {}
  const ruleIds = session(files)
  expect(await ruleIds()).toEqual([])
  files['/home/u/.claude/hookify.no-sudo.local.md'] = draftedRule
  expect(await ruleIds()).toEqual(['personal:no-sudo'])
})
