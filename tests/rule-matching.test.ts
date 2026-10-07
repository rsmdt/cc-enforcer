import { expect, test } from 'claude-code/testing'
import { compileRule, parseRuleFile, resolve, select, type Rule, type RuleSource, type ToolCallInput } from '../src/rules/index.ts'

function rule(source: RuleSource, fileName: string, frontmatter: string, body = 'Do something else.'): Rule {
  const outcome = parseRuleFile(fileName, '---\n' + frontmatter + '\n---\n' + body + '\n')
  if (!outcome.ok) throw new Error(outcome.problem)
  return compileRule(outcome.rule, source)
}

function blocks(rules: Rule[], input: ToolCallInput) {
  const selection = select(rules, 'before-call', input)
  return resolve(selection, new Map())
}

const bashForcePush = rule('project', 'hookify.no-force-push.local.md', 'event: bash\naction: block\npattern: git push .*--force')

test('a bash block rule blocks a matching Bash call with its id and body', () => {
  const result = blocks([bashForcePush], { tool: 'Bash', args: { command: 'git push origin main --force' } })
  expect(result.action).toBe('block')
  expect(result.message).toBe('[cc-enforcer:project:no-force-push] Do something else.')
})

test('a non-matching call passes', () => {
  expect(blocks([bashForcePush], { tool: 'Bash', args: { command: 'git status' } }).action).toBe('pass')
})

test('bash rules never apply to other tools', () => {
  expect(blocks([bashForcePush], { tool: 'Read', args: { command: 'git push --force' } }).action).toBe('pass')
})

const fileConsoleLog = rule('project', 'hookify.console-log.local.md', 'event: file\naction: block\npattern: console\\.log\\(')

test('a file rule matches the content of a Write as new_text', () => {
  expect(blocks([fileConsoleLog], { tool: 'Write', args: { file_path: 'a.ts', content: 'console.log(1)' } }).action).toBe('block')
})

test('a file rule matches Edit new_string and MultiEdit new strings', () => {
  expect(blocks([fileConsoleLog], { tool: 'Edit', args: { file_path: 'a.ts', old_string: 'x', new_string: 'console.log(x)' } }).action).toBe('block')
  expect(
    blocks([fileConsoleLog], {
      tool: 'MultiEdit',
      args: { file_path: 'a.ts', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'console.log(c)' }] },
    }).action,
  ).toBe('block')
  expect(blocks([fileConsoleLog], { tool: 'Edit', args: { file_path: 'a.ts', old_string: 'console.log(x)', new_string: 'y' } }).action).toBe('pass')
})

test('content is the Write content, and new_text for Edit', () => {
  const content = rule('project', 'hookify.c.local.md', 'event: file\naction: block\nconditions:\n  - field: content\n    operator: contains\n    pattern: SECRET')
  expect(blocks([content], { tool: 'Write', args: { file_path: 'a', content: 'SECRET=1' } }).action).toBe('block')
  expect(blocks([content], { tool: 'Edit', args: { file_path: 'a', old_string: 'x', new_string: 'SECRET=1' } }).action).toBe('block')
})

test('old_text is the Edit old string and the MultiEdit old strings joined', () => {
  const old = rule('project', 'hookify.o.local.md', 'event: file\naction: block\nconditions:\n  - field: old_text\n    operator: equals\n    pattern: a c')
  expect(blocks([old], { tool: 'MultiEdit', args: { file_path: 'f', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'd' }] } }).action).toBe('block')
})

test('file rules never apply to Read, Grep or MCP tools', () => {
  const path = rule('project', 'hookify.p.local.md', 'event: file\naction: block\nconditions:\n  - field: file_path\n    operator: contains\n    pattern: .env')
  expect(blocks([path], { tool: 'Read', args: { file_path: '.env' } }).action).toBe('pass')
  expect(blocks([path], { tool: 'Write', args: { file_path: '.env', content: '' } }).action).toBe('block')
})

test('other tools are checked against all rules, on any key of their input', () => {
  const allRule = rule('personal', 'hookify.env.local.md', 'action: block\nconditions:\n  - field: file_path\n    operator: ends_with\n    pattern: .env')
  expect(blocks([allRule], { tool: 'Read', args: { file_path: 'app/.env' } }).action).toBe('block')
  expect(blocks([allRule], { tool: 'mcp__fs__read', args: { file_path: 'app/.env' } }).action).toBe('block')
})

test('an all rule with a simple pattern matches Bash command and file new_text but nothing on other tools', () => {
  const allSimple = rule('project', 'hookify.s.local.md', 'action: block\npattern: danger')
  expect(blocks([allSimple], { tool: 'Bash', args: { command: 'echo danger' } }).action).toBe('block')
  expect(blocks([allSimple], { tool: 'Write', args: { file_path: 'f', content: 'danger' } }).action).toBe('block')
  expect(blocks([allSimple], { tool: 'Grep', args: { pattern: 'danger' } }).action).toBe('pass')
})

test('non-text input values are matched as JSON', () => {
  const json = rule('project', 'hookify.j.local.md', 'action: block\nconditions:\n  - field: limit\n    operator: equals\n    pattern: 500')
  expect(blocks([json], { tool: 'Read', args: { file_path: 'f', limit: 500 } }).action).toBe('block')
})

test('a missing field makes the condition false; an empty field does not', () => {
  const notContains = rule('project', 'hookify.n.local.md', 'action: block\nconditions:\n  - field: description\n    operator: not_contains\n    pattern: ok')
  expect(blocks([notContains], { tool: 'Bash', args: { command: 'ls' } }).action).toBe('pass')
  expect(blocks([notContains], { tool: 'Bash', args: { command: 'ls', description: '' } }).action).toBe('block')
})

test('string operators are literal and case-sensitive; regex_match is not', () => {
  const op = (operator: string, pattern: string) =>
    rule('project', 'hookify.op.local.md', `event: bash\naction: block\nconditions:\n  - field: command\n    operator: ${operator}\n    pattern: '${pattern}'`)
  const input: ToolCallInput = { tool: 'Bash', args: { command: 'Npm run build.sh' } }
  expect(blocks([op('contains', 'npm')], input).action).toBe('pass')
  expect(blocks([op('contains', 'Npm')], input).action).toBe('block')
  expect(blocks([op('contains', 'build.sh')], input).action).toBe('block')
  expect(blocks([op('starts_with', 'Npm run')], input).action).toBe('block')
  expect(blocks([op('ends_with', '.sh')], input).action).toBe('block')
  expect(blocks([op('equals', 'Npm run build.sh')], input).action).toBe('block')
  expect(blocks([op('not_contains', 'yarn')], input).action).toBe('block')
  expect(blocks([op('regex_match', 'NPM RUN')], input).action).toBe('block')
})

test('tool_matcher names exact tools separated by |, or * for any', () => {
  const editOnly = rule('project', 'hookify.e.local.md', 'event: file\naction: block\ntool_matcher: Edit\npattern: x')
  expect(blocks([editOnly], { tool: 'Write', args: { file_path: 'f', content: 'x' } }).action).toBe('pass')
  expect(blocks([editOnly], { tool: 'Edit', args: { file_path: 'f', old_string: '', new_string: 'x' } }).action).toBe('block')
  const any = rule('project', 'hookify.a.local.md', 'action: block\ntool_matcher: "*"\nconditions:\n  - field: file_path\n    operator: contains\n    pattern: x')
  expect(blocks([any], { tool: 'Read', args: { file_path: 'x' } }).action).toBe('block')
})

test('warn rules are not decided before a call', () => {
  const warn = rule('project', 'hookify.w.local.md', 'event: bash\npattern: ls')
  expect(blocks([warn], { tool: 'Bash', args: { command: 'ls' } }).action).toBe('pass')
})

test('same-name copies are checked on their own conditions and only applying copies lend their action', () => {
  const projectCopy = rule('project', 'hookify.no-force-push.local.md', 'event: bash\naction: block\npattern: --force-with-lease', 'Project says no.')
  const personalCopy = rule('personal', 'hookify.no-force-push.local.md', 'event: bash\naction: block\npattern: --force', 'Personal says no.')
  const only = blocks([projectCopy, personalCopy], { tool: 'Bash', args: { command: 'git push --force' } })
  expect(only.action).toBe('block')
  expect(only.message).toBe('[cc-enforcer:personal:no-force-push] Personal says no.')
  const both = blocks([projectCopy, personalCopy], { tool: 'Bash', args: { command: 'git push --force-with-lease' } })
  expect(both.message).toContain('[cc-enforcer:project:no-force-push] Project says no.')
  expect(both.message).toContain('[cc-enforcer:personal:no-force-push] Personal says no.')
})

test('a block rule with an empty body gets the default message', () => {
  const quiet = rule('project', 'hookify.quiet.local.md', 'event: bash\naction: block\npattern: ls', '')
  expect(blocks([quiet], { tool: 'Bash', args: { command: 'ls' } }).message).toBe('[cc-enforcer:project:quiet] this action matches the rule quiet')
})

test('fields are matched on their first 32 KB only', () => {
  const tail = rule('project', 'hookify.t.local.md', 'event: bash\naction: block\npattern: needle')
  expect(blocks([tail], { tool: 'Bash', args: { command: 'a'.repeat(32 * 1024) + 'needle' } }).action).toBe('pass')
  expect(blocks([tail], { tool: 'Bash', args: { command: 'a'.repeat(32 * 1024 - 6) + 'needle' } }).action).toBe('block')
})

const evaluatorBlock = rule(
  'project',
  'hookify.migration.local.md',
  'event: file\naction: block\nconditions:\n  - field: file_path\n    operator: regex_match\n    pattern: migrations/\n  - field: new_text\n    operator: llm_evaluate\n    pattern: Does this change an existing migration?',
)

test('an evaluator rule is pending only when its matchers hold, with content capped at 4 KB', () => {
  const miss = select([evaluatorBlock], 'before-call', { tool: 'Write', args: { file_path: 'src/a.ts', content: 'x' } })
  expect(miss.pending.length).toBe(0)
  const hit = select([evaluatorBlock], 'before-call', { tool: 'Write', args: { file_path: 'db/migrations/1.sql', content: 'y'.repeat(10000) } })
  expect(hit.pending.length).toBe(1)
  expect(hit.pending[0].ruleId).toBe('project:migration')
  expect(hit.pending[0].question).toBe('Does this change an existing migration?')
  expect(hit.pending[0].content.length).toBe(4 * 1024)
})

test('a pending hard rule whose verdict failed blocks with the check-failed message', () => {
  const selection = select([evaluatorBlock], 'before-call', { tool: 'Write', args: { file_path: 'db/migrations/1.sql', content: 'y' } })
  const result = resolve(selection, new Map([['project:migration', 'failed']]))
  expect(result.action).toBe('block')
  expect(result.message).toBe('[cc-enforcer:project:migration] the check could not finish, so this was not run')
  expect(result.failures.map((r) => r.id)).toEqual(['project:migration'])
})

test('a pending rule applies only when its evaluator holds', () => {
  const selection = select([evaluatorBlock], 'before-call', { tool: 'Write', args: { file_path: 'db/migrations/1.sql', content: 'y' } })
  expect(resolve(selection, new Map([['project:migration', 'holds']])).action).toBe('block')
  expect(resolve(selection, new Map([['project:migration', 'does-not-hold']])).action).toBe('pass')
})

test('NFR-1: 100 matcher-only rules decide a call in well under 50 ms at p95', () => {
  const rules = Array.from({ length: 100 }, (_, i) =>
    rule(i % 2 ? 'project' : 'personal', `hookify.r${i}.local.md`, `event: ${i % 3 ? 'bash' : 'file'}\naction: block\npattern: never-${i}-(a|b)+c`),
  )
  const timings: number[] = []
  for (let i = 0; i < 1000; i++) {
    const input: ToolCallInput = i % 2
      ? { tool: 'Bash', args: { command: 'npm run test -- --watch ' + i } }
      : { tool: 'Edit', args: { file_path: 'src/x.ts', old_string: 'a', new_string: 'b'.repeat(2000) } }
    const started = performance.now()
    resolve(select(rules, 'before-call', input), new Map())
    timings.push(performance.now() - started)
  }
  timings.sort((a, b) => a - b)
  expect(timings[Math.floor(timings.length * 0.95)] < 50).toBe(true)
})
