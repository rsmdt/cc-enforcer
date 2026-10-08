import { expect, mock, test } from 'claude-code/testing'
import { stubMods } from './fake-io.ts'

const secrets = '---\nname: no-secrets\nevent: prompt\naction: block\npattern: password\\s*=\n---\nDo not paste passwords. Reference the secret by its vault name instead.\n'
const deploy = '---\nname: deploy-checklist\nevent: prompt\naction: warn\npattern: deploy\n---\nFollow the deploy checklist in docs/deploy.md.\n'
const blockMessage = '[cc-enforcer:project:no-secrets] Do not paste passwords. Reference the secret by its vault name instead.'
const warnMessage = '[cc-enforcer:project:deploy-checklist] Follow the deploy checklist in docs/deploy.md.'

function evaluatorRule(action: 'block' | 'warn') {
  return `---\nname: scope\nevent: prompt\naction: ${action}\nconditions:\n  - field: user_prompt\n    operator: contains\n    pattern: rewrite\n  - field: user_prompt\n    operator: llm_evaluate\n    pattern: Does the prompt ask to rewrite the whole project?\n---\nAsk for one module at a time.\n`
}

function setup(rules: Record<string, string>, extra: Record<string, unknown> = {}) {
  const files: Record<string, string> = {}
  for (const [name, text] of Object.entries(rules)) files[`/repo/.claude/hookify.${name}.local.md`] = text
  return { files, cwd: '/repo', dirs: ['/repo/.git'], ...extra }
}

function submit($, text: string) {
  return $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
}

test('a matching block prompt rule drops the prompt and shows the user the rule message', async ($, on) => {
  const mods = stubMods(on, setup({ secrets }))
  const result = await submit($, 'connect with password = hunter2')
  expect(result.drop).toBe(blockMessage)
  expect(mods.prompts).toEqual([])
})

test('a prompt no rule matches is sent unchanged', async ($, on) => {
  const mods = stubMods(on, setup({ secrets, deploy }))
  const result = await submit($, 'list the files')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts).toEqual([{ text: 'list the files', context: undefined }])
})

test('a matching warn prompt rule sends the prompt with the rule message for Claude', async ($, on) => {
  const mods = stubMods(on, setup({ deploy }))
  const result = await submit($, 'deploy the app')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts).toEqual([{ text: 'deploy the app', context: [warnMessage] }])
})

test('the simple pattern of a prompt rule is matched against the submitted text', async ($, on) => {
  const mods = stubMods(on, setup({ secrets }))
  expect((await submit($, 'PASSWORD= x')).drop).toBe(blockMessage)
  expect((await submit($, 'what is a password manager')).drop).toBeUndefined()
  expect(mods.prompts.map((prompt) => prompt.text)).toEqual(['what is a password manager'])
})

test('a condition on user_prompt reads the submitted text', async ($, on) => {
  const rule = '---\nname: no-force\nevent: prompt\naction: block\nconditions:\n  - field: user_prompt\n    operator: starts_with\n    pattern: force\n---\nDo not start with force.\n'
  stubMods(on, setup({ rule }))
  expect((await submit($, 'force push it')).drop).toBe('[cc-enforcer:project:no-force] Do not start with force.')
  expect((await submit($, 'please force push it')).drop).toBeUndefined()
})

test('a block rule outranks a warn rule on the same prompt', async ($, on) => {
  stubMods(on, setup({ secrets, deploy }))
  const result = await submit($, 'deploy with password = x')
  expect(result.drop).toBe(blockMessage)
})

test('a plain-language block condition on the prompt is judged before the prompt is sent', async ($, on) => {
  mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('block') }, { classify: async () => 'yes' }))
  const result = await submit($, 'rewrite everything in Rust')
  expect(result.drop).toBe('[cc-enforcer:project:scope] Ask for one module at a time.')
  expect(mods.prompts).toEqual([])
  expect(mods.classified.length).toBe(1)
  expect(mods.classified[0]).toContain('rewrite everything in Rust')
})

test('a plain-language condition that does not hold lets the prompt through', async ($, on) => {
  mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('block') }, { classify: async () => 'no' }))
  const result = await submit($, 'rewrite this function')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts).toEqual([{ text: 'rewrite this function', context: undefined }])
})

test('no evaluation is requested when a matcher condition of the prompt rule does not hold', async ($, on) => {
  mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('block') }, { classify: async () => 'yes' }))
  const result = await submit($, 'add a test')
  expect(result.drop).toBeUndefined()
  expect(mods.classified).toEqual([])
})

test('a plain-language warn condition that holds sends the prompt with the message', async ($, on) => {
  mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('warn') }, { classify: async () => 'yes' }))
  await submit($, 'rewrite the whole thing')
  expect(mods.prompts).toEqual([{ text: 'rewrite the whole thing', context: ['[cc-enforcer:project:scope] Ask for one module at a time.'] }])
})

test('a block rule whose check fails drops the prompt and names the rule', async ($, on) => {
  const mods = stubMods(on, setup({ scope: evaluatorRule('block') }))
  const result = await submit($, 'rewrite everything')
  expect(result.drop).toBe('[cc-enforcer:project:scope] the check could not finish, so this was not run')
  expect(mods.prompts).toEqual([])
})

test('a block rule whose check runs out of time drops the prompt', async ($, on) => {
  const clock = mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('block') }, { classify: () => new Promise(() => undefined) }))
  const pending = submit($, 'rewrite everything')
  await clock.advance(5000)
  const result = await pending
  expect(result.drop).toBe('[cc-enforcer:project:scope] the check could not finish, so this was not run')
  expect(mods.prompts).toEqual([])
})

test('a warn rule whose check fails still sends the prompt and tells the user which rule failed', async ($, on) => {
  const mods = stubMods(on, setup({ scope: evaluatorRule('warn') }))
  const result = await submit($, 'rewrite everything')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts).toEqual([{ text: 'rewrite everything', context: undefined }])
  expect(mods.userLines).toEqual(['cc-enforcer: the check of rule project:scope could not finish, so the prompt was sent'])
})

test('a warn rule whose check runs out of time sends the prompt and tells the user', async ($, on) => {
  const clock = mock.clock(on)
  const mods = stubMods(on, setup({ scope: evaluatorRule('warn') }, { classify: () => new Promise(() => undefined) }))
  const pending = submit($, 'rewrite everything')
  await clock.advance(5000)
  const result = await pending
  expect(result.drop).toBeUndefined()
  expect(mods.prompts.map((prompt) => prompt.text)).toEqual(['rewrite everything'])
  expect(mods.userLines).toEqual(['cc-enforcer: the check of rule project:scope could not finish, so the prompt was sent'])
})

test('a failed warn check on a prompt is logged as a check failure for that rule', async ($, on) => {
  const mods = stubMods(on, setup({ scope: evaluatorRule('warn') }))
  await submit($, 'rewrite everything')
  await new Promise((resolve) => setTimeout(resolve, 0))
  const log = mods.writes.get('/home/u/.cc-enforcer/logs/session-1.jsonl') ?? ''
  const lines = log.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  expect(lines.map((line) => [line.kind, line.event, line.ruleId])).toEqual([['check-failed', 'prompt', 'project:scope']])
  expect(log).not.toContain('rewrite everything')
})

test('if the enforcer fails before any rule is in flight, the prompt is sent and the user is told', async ($, on) => {
  const mods = stubMods(on, setup({ secrets }, { failing: ['session.cwd'] }))
  const result = await submit($, 'password = x')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts.map((prompt) => prompt.text)).toEqual(['password = x'])
  expect(mods.userLines.join('\n')).toContain('could not finish')
})

test('an all rule with a simple pattern applies to prompts', async ($, on) => {
  const everywhere = '---\nname: no-prod\nevent: all\naction: block\npattern: prod-db\n---\nUse the staging database.\n'
  stubMods(on, setup({ everywhere }))
  expect((await submit($, 'query prod-db')).drop).toBe('[cc-enforcer:project:no-prod] Use the staging database.')
})

test('an all ask rule is not applied to prompts', async ($, on) => {
  const everywhere = '---\nname: confirm-prod\nevent: all\naction: ask\npattern: prod-db\n---\nTouching production.\n'
  const mods = stubMods(on, setup({ everywhere }))
  const result = await submit($, 'query prod-db')
  expect(result.drop).toBeUndefined()
  expect(mods.prompts.map((prompt) => prompt.text)).toEqual(['query prod-db'])
})

test('a prompt rule does not apply to tool calls', async ($, on) => {
  const promptRule = '---\nname: no-rm-prompt\nevent: prompt\naction: block\npattern: rm -rf\n---\nDo not ask for recursive deletes.\n'
  const mods = stubMods(on, setup({ promptRule }))
  expect((await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })).result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
})

test('a bash rule does not apply to prompts', async ($, on) => {
  const bash = '---\nname: no-rm\nevent: bash\naction: block\npattern: rm -rf\n---\nDo not delete recursively.\n'
  const mods = stubMods(on, setup({ bash }))
  expect((await submit($, 'rm -rf build')).drop).toBeUndefined()
  expect(mods.prompts.map((prompt) => prompt.text)).toEqual(['rm -rf build'])
})

test('a dropped prompt is logged by rule and outcome without the prompt text', async ($, on) => {
  const mods = stubMods(on, setup({ secrets }))
  await submit($, 'password = hunter2')
  await new Promise((resolve) => setTimeout(resolve, 0))
  const log = mods.writes.get('/home/u/.cc-enforcer/logs/session-1.jsonl') ?? ''
  const lines = log.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  expect(lines.map((line) => [line.kind, line.event, line.ruleId])).toEqual([['block', 'prompt', 'project:no-secrets']])
  expect(log).not.toContain('hunter2')
})
