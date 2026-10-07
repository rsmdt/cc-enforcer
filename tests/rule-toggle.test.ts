import { expect, test } from 'claude-code/testing'
import { parseRuleFile, setEnabled } from '../src/rules/index.ts'
import { createRuleSources, type SourceIo } from '../src/sources/index.ts'
import { fakeIo } from './fake-io.ts'

const rule = (extra = '') => `---\n${extra}event: bash\naction: block\npattern: --force\n---\nNever force-push.\n`
const ignore = () => undefined

function writableIo(files: Record<string, string>, cwd = '/repo') {
  const io = fakeIo(files, { cwd, home: '/home/u', dirs: ['/repo/.git'] })
  const written: string[] = []
  const withWrite: SourceIo = {
    ...io,
    write: async (path, text) => {
      written.push(path)
      files[path] = text
    },
  }
  return { io: withWrite, written }
}

test('setEnabled rewrites an existing enabled line and keeps the rest of the file', () => {
  const text = rule('name: no-force-push\nenabled: true\n')
  const off = setEnabled(text, false)
  expect(off).toBe(rule('name: no-force-push\nenabled: false\n'))
  const parsed = parseRuleFile('hookify.x.local.md', off)
  expect(parsed.ok && parsed.rule.enabled).toBe(false)
})

test('setEnabled adds enabled as the first frontmatter line when it is missing', () => {
  expect(setEnabled(rule(), false)).toBe(rule('enabled: false\n'))
})

test('setEnabled keeps Windows line endings', () => {
  const text = '---\r\nenabled: false\r\nevent: bash\r\npattern: x\r\n---\r\nb\r\n'
  expect(setEnabled(text, true)).toBe('---\r\nenabled: true\r\nevent: bash\r\npattern: x\r\n---\r\nb\r\n')
})

test('switching a rule off writes enabled: false and it stops applying at once', async () => {
  const path = '/repo/.claude/hookify.no-force-push.local.md'
  const files = { [path]: rule() }
  const { io, written } = writableIo(files)
  const sources = createRuleSources()
  expect((await sources.current(io, ignore)).map((r) => r.id)).toEqual(['project:no-force-push'])
  const outcome = await sources.toggle(io, ignore, 'no-force-push', false)
  expect(outcome).toEqual({ kind: 'switched', id: 'project:no-force-push', path, enabled: false })
  expect(written).toEqual([path])
  expect(files[path]).toBe(rule('enabled: false\n'))
  expect(await sources.current(io, ignore)).toEqual([])
  expect(await createRuleSources().current(io, ignore)).toEqual([])
})

test('switching an off rule on makes it apply again', async () => {
  const path = '/home/u/.claude/hookify.no-sudo.local.md'
  const files = { [path]: rule('enabled: false\n') }
  const { io } = writableIo(files)
  const sources = createRuleSources()
  expect(await sources.current(io, ignore)).toEqual([])
  expect((await sources.toggle(io, ignore, 'no-sudo', true)).kind).toBe('switched')
  expect((await sources.current(io, ignore)).map((r) => r.id)).toEqual(['personal:no-sudo'])
})

test('an unknown rule name changes nothing', async () => {
  const files = { '/repo/.claude/hookify.a.local.md': rule() }
  const { io, written } = writableIo(files)
  expect(await createRuleSources().toggle(io, ignore, 'missing', false)).toEqual({ kind: 'none', name: 'missing' })
  expect(written).toEqual([])
})

test('a name in both folders without a source changes nothing; with a source only that file changes', async () => {
  const project = '/repo/.claude/hookify.no-force-push.local.md'
  const personal = '/home/u/.claude/hookify.no-force-push.local.md'
  const files = { [project]: rule(), [personal]: rule() }
  const { io, written } = writableIo(files)
  const sources = createRuleSources()
  expect(await sources.toggle(io, ignore, 'no-force-push', false)).toEqual({ kind: 'ambiguous', name: 'no-force-push' })
  expect(written).toEqual([])
  expect((await sources.toggle(io, ignore, 'no-force-push', false, 'personal')).kind).toBe('switched')
  expect(written).toEqual([personal])
  expect((await sources.current(io, ignore)).map((r) => r.id)).toEqual(['project:no-force-push'])
})

test('a rule already in the asked state is left as it is', async () => {
  const files = { '/repo/.claude/hookify.a.local.md': rule() }
  const { io, written } = writableIo(files)
  expect(await createRuleSources().toggle(io, ignore, 'a', true)).toEqual({ kind: 'unchanged', id: 'project:a', enabled: true })
  expect(written).toEqual([])
})

test('a file edited after it was read is never overwritten', async () => {
  const path = '/repo/.claude/hookify.a.local.md'
  const files = { [path]: rule() }
  const { io, written } = writableIo(files)
  let stats = 0
  const editedMidway: SourceIo = {
    ...io,
    stat: async (statPath) => {
      const stat = await io.stat(statPath)
      return statPath === path && ++stats > 2 ? { ...stat, mtimeMs: stat.mtimeMs + 1 } : stat
    },
  }
  expect(await createRuleSources().toggle(editedMidway, ignore, 'a', false)).toEqual({ kind: 'changed', id: 'project:a', path })
  expect(written).toEqual([])
})

test('the overview lists every valid rule, on or off, with its source and the folders', async () => {
  const files = {
    '/repo/.claude/hookify.a.local.md': rule(),
    '/home/u/.claude/hookify.b.local.md': rule('enabled: false\n'),
  }
  const { io } = writableIo(files, '/repo/app')
  const overview = await createRuleSources().overview(io, ignore)
  expect(overview.rules.map((r) => [r.id, r.enabled])).toEqual([
    ['project:a', true],
    ['personal:b', false],
  ])
  expect(overview.projectFolder).toBe('/repo/.claude')
  expect(overview.personalFolder).toBe('/home/u/.claude')
})

test('with no rule files the overview names the working directory .claude folder as the project folder', async () => {
  const { io } = writableIo({}, '/repo/app')
  const overview = await createRuleSources().overview(io, ignore)
  expect(overview.rules).toEqual([])
  expect(overview.projectFolder).toBe('/repo/app/.claude')
})
