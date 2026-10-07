import { expect, test } from 'claude-code/testing'
import { translatePattern } from '../src/rules/index.ts'

function compiled(pattern: string) {
  const outcome = translatePattern(pattern)
  if (!outcome.ok) throw new Error('expected a translation, got: ' + outcome.problem)
  return outcome.regex
}

function rejected(pattern: string) {
  const outcome = translatePattern(pattern)
  if (outcome.ok) throw new Error('expected a rejection of ' + pattern)
  return outcome.problem
}

test('matching is case-insensitive and finds the pattern anywhere', () => {
  expect(compiled('rm\\s+-rf').test('sudo RM  -RF /')).toBe(true)
})

test('named groups and named backreferences are translated', () => {
  const regex = compiled('(?P<word>ab)-(?P=word)')
  expect(regex.test('xx ab-ab')).toBe(true)
  expect(regex.test('ab-cd')).toBe(false)
})

test('\\A and \\Z anchor the whole field even with the multiline flag', () => {
  const regex = compiled('(?m)\\Afoo')
  expect(regex.test('foo\nbar')).toBe(true)
  expect(regex.test('bar\nfoo')).toBe(false)
  const end = compiled('(?m)bar\\Z')
  expect(end.test('foo\nbar')).toBe(true)
  expect(end.test('bar\nfoo')).toBe(false)
})

test('leading inline flags become RegExp flags', () => {
  expect(compiled('(?s)a.b').test('a\nb')).toBe(true)
  expect(compiled('(?m)^b').test('a\nb')).toBe(true)
  expect(compiled('(?i)ABC').test('abc')).toBe(true)
  expect(compiled('(?sm)a.^b').test('a\nb')).toBe(true)
})

test('{,n} means zero to n as in Python', () => {
  const regex = compiled('^a{,2}$')
  expect(regex.test('')).toBe(true)
  expect(regex.test('aa')).toBe(true)
  expect(regex.test('aaa')).toBe(false)
})

test('escaped and bracketed forms are left alone', () => {
  expect(compiled('\\\\A').test('\\A')).toBe(true)
  expect(compiled('[(?P]').test('P')).toBe(true)
})

test('Python-only forms that cannot be translated are rejected', () => {
  expect(rejected('(?>atomic)')).toMatch(/Python/)
  expect(rejected('(?(1)a|b)')).toMatch(/Python/)
  expect(rejected('(?#comment)a')).toMatch(/Python/)
  expect(rejected('a(?i)b')).toMatch(/Python|flag/)
  expect(rejected('(?x)a b')).toMatch(/flag/)
  expect(rejected('a++')).toMatch(/regular expression/)
  expect(rejected('(unclosed')).toMatch(/regular expression/)
})
