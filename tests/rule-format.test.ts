import { expect, test } from 'claude-code/testing'
import { defaultName, parseRuleFile, RULE_FILE_PATTERN } from '../src/rules/index.ts'

function parsed(fileName: string, text: string) {
  const outcome = parseRuleFile(fileName, text)
  if (!outcome.ok) throw new Error('expected a valid rule, got: ' + outcome.problem)
  return outcome.rule
}

function problemOf(text: string, fileName = 'hookify.sample.local.md') {
  const outcome = parseRuleFile(fileName, text)
  if (outcome.ok) throw new Error('expected an invalid rule')
  return outcome.problem
}

test('a rule file declares its event, action, tool matcher, conditions and body', () => {
  const rule = parsed(
    'hookify.no-migration-edits.local.md',
    [
      '---',
      'name: no-migration-edits',
      'enabled: true',
      'event: file',
      'action: block',
      'tool_matcher: Edit|Write',
      'conditions:',
      '  - field: file_path',
      '    operator: regex_match',
      '    pattern: db/migrations/.*\\.sql$',
      '  - field: new_text',
      '    operator: contains',
      '    pattern: DROP',
      '---',
      '',
      'Add a new migration instead.',
      '',
    ].join('\n'),
  )
  expect(rule.name).toBe('no-migration-edits')
  expect(rule.enabled).toBe(true)
  expect(rule.event).toBe('file')
  expect(rule.action).toBe('block')
  expect(rule.toolMatcher).toBe('Edit|Write')
  expect(rule.conditions.map((c) => [c.field, c.operator, c.pattern])).toEqual([
    ['file_path', 'regex_match', 'db/migrations/.*\\.sql$'],
    ['new_text', 'contains', 'DROP'],
  ])
  expect(rule.body).toBe('Add a new migration instead.')
})

test('defaults follow Hookify: event all, action warn, enabled true', () => {
  const rule = parsed('hookify.x.local.md', '---\npattern: foo\n---\nbody\n')
  expect(rule.event).toBe('all')
  expect(rule.action).toBe('warn')
  expect(rule.enabled).toBe(true)
})

test('a missing name defaults to the file-name part between hookify. and .local.md', () => {
  const rule = parsed('hookify.no-force-push.local.md', '---\nevent: bash\npattern: push --force\n---\nNo.\n')
  expect(rule.name).toBe('no-force-push')
  expect(defaultName('hookify.a.b.local.md')).toBe('a.b')
})

test('the rule file pattern matches only hookify.*.local.md', () => {
  expect(RULE_FILE_PATTERN.test('hookify.x.local.md')).toBe(true)
  expect(RULE_FILE_PATTERN.test('hookify.local.md')).toBe(false)
  expect(RULE_FILE_PATTERN.test('hookify.x.md')).toBe(false)
  expect(RULE_FILE_PATTERN.test('other.x.local.md')).toBe(false)
})

test('enabled: false is read as off', () => {
  expect(parsed('hookify.x.local.md', '---\nenabled: false\npattern: a\n---\nb').enabled).toBe(false)
})

test('a simple pattern becomes one regex_match condition on the event field', () => {
  const rule = parsed('hookify.x.local.md', '---\nevent: bash\npattern: rm\\s+-rf\n---\nb')
  expect(rule.conditions.length).toBe(1)
  expect(rule.conditions[0].simple).toBe(true)
  expect(rule.conditions[0].operator).toBe('regex_match')
})

test('single-quoted and double-quoted values are read as YAML reads them', () => {
  const rule = parsed('hookify.x.local.md', "---\nname: \"quoted name\"\nevent: bash\npattern: 'rm\\s+-rf'\n---\nb")
  expect(rule.name).toBe('quoted name')
  expect(rule.conditions[0].pattern).toBe('rm\\s+-rf')
})

test('conditions may sit at the same indent as their key when fields are indented past two spaces', () => {
  const rule = parsed(
    'hookify.x.local.md',
    '---\nevent: bash\nconditions:\n-   field: command\n    operator: contains\n    pattern: sudo\n---\nb',
  )
  expect(rule.conditions[0].pattern).toBe('sudo')
})

test('an empty body loads with a warning and the default message', () => {
  const outcome = parseRuleFile('hookify.quiet.local.md', '---\nevent: bash\npattern: x\n---\n')
  expect(outcome.ok).toBe(true)
  if (!outcome.ok) return
  expect(outcome.rule.body).toBe('')
  expect(outcome.warnings.join(' ')).toMatch(/empty/)
})

test('llm_evaluate conditions make the rule an evaluator rule', () => {
  const rule = parsed(
    'hookify.x.local.md',
    '---\nevent: file\naction: block\nconditions:\n  - field: new_text\n    operator: llm_evaluate\n    pattern: Does this change an existing migration?\n---\nb',
  )
  expect(rule.kind).toBe('evaluator')
})

const invalidCases: Array<[string, string, RegExp]> = [
  ['no frontmatter', 'just text', /frontmatter/],
  ['unclosed frontmatter', '---\nevent: bash\npattern: x\n', /frontmatter/],
  ['unknown event', '---\nevent: tool\npattern: x\n---\nb', /event/],
  ['unknown action', '---\naction: deny\npattern: x\n---\nb', /action/],
  ['unknown operator', '---\nconditions:\n  - field: command\n    operator: matches\n    pattern: x\n---\nb', /operator/],
  ['invalid regex', '---\npattern: (unclosed\n---\nb', /regular expression/],
  ['empty pattern', "---\npattern: ''\n---\nb", /pattern/],
  ['condition without field', '---\nconditions:\n  - operator: contains\n    pattern: x\n---\nb', /field/],
  ['condition without pattern', '---\nconditions:\n  - field: command\n    operator: contains\n---\nb', /pattern/],
  ['ask on stop', '---\nevent: stop\naction: ask\npattern: x\n---\nb', /ask/],
  ['ask on prompt', '---\nevent: prompt\naction: ask\npattern: x\n---\nb', /ask/],
  ['llm_evaluate on stop', '---\nevent: stop\nconditions:\n  - field: transcript\n    operator: llm_evaluate\n    pattern: Done?\n---\nb', /llm_evaluate/],
  ['no pattern and no conditions', '---\nevent: bash\naction: block\n---\nb', /pattern|condition/],
  ['a value containing --- that Hookify cuts', '---\nevent: bash\npattern: a---b\n---\nb', /---/],
  ['an inline condition Hookify splits at a comma', '---\nconditions:\n  - field: command, operator: contains, pattern: x\n---\nb', /comma/],
  ['a list item value with a comma', '---\nconditions:\n  - pattern: a,b\n    field: command\n    operator: regex_match\n---\nb', /comma/],
  ['condition fields Hookify drops at two-space indent', '---\nconditions:\n- field: command\n  operator: contains\n  pattern: x\n---\nb', /indent/],
  ['a tab in the frontmatter', '---\nevent:\tbash\npattern: x\n---\nb', /tab/],
  ['a block scalar', '---\npattern: |\n  x\n---\nb', /YAML|quote/],
  ['a comment after an unquoted value', '---\nevent: bash\npattern: rm -rf # dangerous\n---\nb', /comment/],
  ['a double-quoted value with a backslash', '---\nevent: bash\npattern: "rm\\\\s"\n---\nb', /backslash|single quotes/],
  ['a single-quoted value with an escaped quote', "---\nevent: bash\npattern: 'it''s'\n---\nb", /quote/],
  ['a flow sequence where Hookify sees text', '---\nevent: bash\npattern: [abc]\n---\nb', /quote|YAML/],
  ['an unquoted * tool matcher', '---\ntool_matcher: *\npattern: x\n---\nb', /quote|YAML/],
  ['a key with no value', '---\nname:\nevent: bash\npattern: x\n---\nb', /value/],
  ['a duplicated key', '---\nevent: bash\nevent: file\npattern: x\n---\nb', /twice|duplicate/],
  ['a Python-only regex form', '---\npattern: (?>atomic)\n---\nb', /regular expression|Python/],
]

for (const [label, text, expected] of invalidCases) {
  test('reports as invalid: ' + label, () => {
    expect(problemOf(text)).toMatch(expected)
  })
}
