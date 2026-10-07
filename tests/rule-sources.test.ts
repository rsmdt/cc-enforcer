import { expect, test } from 'claude-code/testing'
import { createRuleSources, type Rejection } from '../src/sources/index.ts'
import { fakeIo, type FakeGit } from './fake-io.ts'

const blockRule = (pattern: string, extra = '') => `---\nevent: bash\naction: block\npattern: ${pattern}\n${extra}---\nUse something else.\n`

async function load(files: Record<string, string>, cwd: string, dirs: string[] = [], git?: FakeGit) {
  const rejections: Rejection[] = []
  const sources = createRuleSources()
  const io = fakeIo(files, { cwd, home: '/home/u', dirs, git })
  const rules = await sources.current(io, (rejection) => rejections.push(rejection))
  return { rules, rejections, sources, io, report: (rejection: Rejection) => rejections.push(rejection) }
}

test('project and personal rules are both active and each carries its source', async () => {
  const { rules } = await load(
    {
      '/repo/.claude/hookify.no-rm.local.md': blockRule('rm -rf'),
      '/home/u/.claude/hookify.no-sudo.local.md': blockRule('sudo'),
    },
    '/repo',
    ['/repo/.git'],
  )
  expect(rules.map((rule) => [rule.id, rule.source])).toEqual([
    ['project:no-rm', 'project'],
    ['personal:no-sudo', 'personal'],
  ])
})

test('an invalid file is reported with its path and problem, once, and the other rules still apply', async () => {
  const { rules, rejections, sources, io, report } = await load(
    {
      '/repo/.claude/hookify.broken.local.md': '---\nevent: nope\npattern: x\n---\nb',
      '/repo/.claude/hookify.good.local.md': blockRule('x'),
    },
    '/repo',
    ['/repo/.git'],
  )
  expect(rules.map((rule) => rule.id)).toEqual(['project:good'])
  expect(rejections.length).toBe(1)
  expect(rejections[0].path).toBe('/repo/.claude/hookify.broken.local.md')
  expect(rejections[0].problem).toMatch(/event/)
  await sources.current(io, report)
  expect(rejections.length).toBe(1)
})

test('a switched-off rule is not active', async () => {
  const { rules } = await load({ '/repo/.claude/hookify.off.local.md': blockRule('x', 'enabled: false\n') }, '/repo', ['/repo/.git'])
  expect(rules).toEqual([])
})

test('files that are not hookify.*.local.md are ignored', async () => {
  const { rules } = await load(
    { '/repo/.claude/settings.json': '{}', '/repo/.claude/hookify.x.md': blockRule('x') },
    '/repo',
    ['/repo/.git'],
  )
  expect(rules).toEqual([])
})

test('project rules apply from a subdirectory, searching up to the git root', async () => {
  const { rules } = await load({ '/repo/.claude/hookify.a.local.md': blockRule('x') }, '/repo/packages/app/src', ['/repo/.git'])
  expect(rules.map((rule) => rule.id)).toEqual(['project:a'])
})

test('the search never goes above the git root', async () => {
  const { rules } = await load({ '/outer/.claude/hookify.a.local.md': blockRule('x') }, '/outer/repo/sub', ['/outer/repo/.git'])
  expect(rules).toEqual([])
})

test('the nearest .claude folder holding rule files is the project folder', async () => {
  const { rules } = await load(
    {
      '/repo/.claude/hookify.root.local.md': blockRule('x'),
      '/repo/app/.claude/hookify.near.local.md': blockRule('x'),
      '/repo/app/src/.claude/settings.json': '{}',
    },
    '/repo/app/src',
    ['/repo/.git'],
  )
  expect(rules.map((rule) => rule.id)).toEqual(['project:near'])
})

test('outside a git repository only the working directory .claude folder is read', async () => {
  const above = await load({ '/tmp/x/.claude/hookify.a.local.md': blockRule('x') }, '/tmp/x/y')
  expect(above.rules).toEqual([])
  const own = await load({ '/tmp/x/y/.claude/hookify.a.local.md': blockRule('x') }, '/tmp/x/y')
  expect(own.rules.map((rule) => rule.id)).toEqual(['project:a'])
})

test('a .git entry that git does not accept as a repository does not widen the search', async () => {
  const files = { '/top/.claude/hookify.no-force-push.local.md': blockRule('--force') }
  const decoyFile = await load({ ...files, '/top/.git': '' }, '/top/sub', [], 'not-a-repo')
  expect(decoyFile.rules).toEqual([])
  const decoyDir = await load(files, '/top/sub', ['/top/.git'], 'not-a-repo')
  expect(decoyDir.rules).toEqual([])
})

test('when git cannot be run the search still stops at the nearest .git', async () => {
  const inRepo = await load({ '/repo/.claude/hookify.a.local.md': blockRule('x') }, '/repo/app', ['/repo/.git'], 'unavailable')
  expect(inRepo.rules.map((rule) => rule.id)).toEqual(['project:a'])
  const outside = await load({ '/tmp/x/.claude/hookify.a.local.md': blockRule('x') }, '/tmp/x/y', [], 'unavailable')
  expect(outside.rules).toEqual([])
})

test('the personal folder is never loaded as the project folder', async () => {
  const atHome = await load({ '/home/u/.claude/hookify.mine.local.md': blockRule('x') }, '/home/u')
  expect(atHome.rules.map((rule) => rule.id)).toEqual(['personal:mine'])
  const dotfilesRepo = await load({ '/home/u/.claude/hookify.mine.local.md': blockRule('x') }, '/home/u/code', ['/home/u/.git'])
  expect(dotfilesRepo.rules.map((rule) => rule.id)).toEqual(['personal:mine'])
})

test('same-name rules in the two folders are separate rules', async () => {
  const { rules } = await load(
    {
      '/repo/.claude/hookify.no-force-push.local.md': blockRule('--force'),
      '/home/u/.claude/hookify.no-force-push.local.md': blockRule('--force'),
    },
    '/repo',
    ['/repo/.git'],
  )
  expect(rules.map((rule) => rule.id)).toEqual(['project:no-force-push', 'personal:no-force-push'])
})

test('two files in one folder declaring the same name keep the first by file name and report the other', async () => {
  const { rules, rejections } = await load(
    {
      '/repo/.claude/hookify.b.local.md': blockRule('x', 'name: shared\n'),
      '/repo/.claude/hookify.a.local.md': blockRule('y', 'name: shared\n'),
    },
    '/repo',
    ['/repo/.git'],
  )
  expect(rules.map((rule) => rule.conditions[0].pattern)).toEqual(['y'])
  expect(rejections.map((rejection) => rejection.path)).toEqual(['/repo/.claude/hookify.b.local.md'])
  expect(rejections[0].problem).toMatch(/shared/)
})

test('a folder that cannot be listed counts as empty and never throws', async () => {
  const rejections: Rejection[] = []
  const io = fakeIo({ '/home/u/.claude/hookify.mine.local.md': blockRule('x') }, { cwd: '/repo', home: '/home/u', dirs: ['/repo/.git'], unlistable: ['/repo/.claude'] })
  const rules = await createRuleSources().current(io, (rejection) => rejections.push(rejection))
  expect(rules.map((rule) => rule.id)).toEqual(['personal:mine'])
})
