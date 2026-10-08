import { expect, test } from 'claude-code/testing'
import { stubMods } from './fake-io.ts'

const rmWarning = '---\nname: careful-rm\nevent: bash\naction: warn\npattern: rm -rf\n---\nPrefer moving files to the trash with trash-cli.\n'
const consoleLog = '---\nevent: file\npattern: console\\.log\\(\n---\nUse the project logger instead of console.log.\n'
const forcePush = '---\nname: no-force-push\nevent: bash\naction: block\npattern: git push .*--force\n---\nNever force-push. Push to a new branch and open a pull request.\n'
const pushWarning = '---\nname: push-review\nevent: bash\naction: warn\npattern: git push\n---\nMention the push in the pull request description.\n'
const reviewedWarning = '---\nname: reviewed-rm\nevent: bash\naction: warn\nconditions:\n  - field: command\n    operator: contains\n    pattern: rm\n  - field: command\n    operator: llm_evaluate\n    pattern: Does this delete source files?\n---\nKeep source files.\n'

const rmFinding = '[cc-enforcer:project:careful-rm] Prefer moving files to the trash with trash-cli.'

const repo = {
  files: {
    '/repo/.claude/hookify.careful-rm.local.md': rmWarning,
    '/repo/.claude/hookify.console-log.local.md': consoleLog,
  },
  cwd: '/repo',
  dirs: ['/repo/.git'],
}

function logLines(writes: Map<string, string>) {
  const text = writes.get('/home/u/.cc-enforcer/logs/session-1.jsonl') ?? ''
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('a matching warn rule lets the call run and Claude reads the finding with its result', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(result.deny).toBeUndefined()
  expect(result.result).toBe('ran')
  expect(result.context).toEqual([rmFinding])
  expect(mods.toolCalls).toEqual(['Bash'])
})

test('a warn finding is shown to the user as coming from cc-enforcer and logged without the command', async ($, on) => {
  const mods = stubMods(on, repo)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  await settled()
  expect(mods.userLines).toContain(rmFinding)
  const lines = logLines(mods.writes)
  expect(lines.map((line) => [line.kind, line.ruleId, line.ruleName, line.action, line.tool, line.agentLabel])).toEqual([
    ['finding', 'project:careful-rm', 'careful-rm', 'warn', 'Bash', 'main session'],
  ])
  expect([...mods.writes.values()].join('\n')).not.toContain('rm -rf')
})

test('a rule with no action line warns, so a written console.log reaches Claude with the result', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Write', file_path: '/repo/src/a.ts', content: 'console.log(1)' })
  expect(result.result).toBe('ran')
  expect(result.context).toEqual(['[cc-enforcer:project:console-log] Use the project logger instead of console.log.'])
  await settled()
  expect(logLines(mods.writes).map((line) => [line.kind, line.ruleId, line.target])).toEqual([['finding', 'project:console-log', '/repo/src/a.ts']])
})

test('a call no warn rule matches gets its result unchanged and nothing is logged', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(result.result).toBe('ran')
  expect(result.context ?? []).toEqual([])
  await settled()
  expect(logLines(mods.writes)).toEqual([])
  expect(mods.userLines).toEqual([])
})

test('every matching warn rule adds its own named finding', async ($, on) => {
  const mods = stubMods(on, { ...repo, files: { ...repo.files, '/repo/.claude/hookify.push-review.local.md': pushWarning } })
  const result = await $.tool.call({ tool: 'Bash', command: 'git push && rm -rf build' })
  expect(result.context).toEqual([rmFinding, '[cc-enforcer:project:push-review] Mention the push in the pull request description.'])
  expect(mods.toolCalls).toEqual(['Bash'])
})

test('a warn rule is not checked before the call: a block rule alone decides and no finding is attached', async ($, on) => {
  const mods = stubMods(on, {
    ...repo,
    files: { '/repo/.claude/hookify.no-force-push.local.md': forcePush, '/repo/.claude/hookify.push-review.local.md': pushWarning },
  })
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  expect(result.deny).toBe('[cc-enforcer:project:no-force-push] Never force-push. Push to a new branch and open a pull request.')
  expect(mods.toolCalls).toEqual([])
  await settled()
  expect(logLines(mods.writes).map((line) => line.kind)).toEqual(['block'])
})

test('a warn rule with a plain-language check is left for review and adds nothing to the result', async ($, on) => {
  const mods = stubMods(on, { ...repo, files: { '/repo/.claude/hookify.reviewed-rm.local.md': reviewedWarning } })
  const result = await $.tool.call({ tool: 'Bash', command: 'rm src/a.ts' })
  expect(result.result).toBe('ran')
  expect(result.context ?? []).toEqual([])
  await settled()
  expect(logLines(mods.writes)).toEqual([])
})

test('a subagent call gets the finding and the log names the agent', async ($, on) => {
  const mods = stubMods(on, { ...repo, agents: [{ id: 'agent-7', type: 'Explore', description: 'look around', status: 'running' }] })
  const result = await $.tool.call({ tool: 'Bash', command: 'rm -rf build', agentId: 'agent-7' })
  expect(result.context).toEqual([rmFinding])
  await settled()
  expect(logLines(mods.writes).map((line) => [line.kind, line.agentLabel])).toEqual([['finding', 'Explore']])
})

test('if the warn check fails after the call ran, the result comes back and the user is told', async ($, on) => {
  const mods = stubMods(on, { ...repo, failingAfterTool: ['ui.log', 'agent.list'] })
  const result = await $.tool.call({ tool: 'Bash', command: 'rm -rf build', agentId: 'agent-7' })
  expect(result.deny).toBeUndefined()
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
})

test('if the after-call check throws, the call is not denied, the user is told and the failure is logged', async ($, on) => {
  const mods = stubMods(on, { ...repo, failingAfterTool: ['session.cwd'] })
  const result = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(result.deny).toBeUndefined()
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
  await settled()
  expect(mods.userLines).toContain('cc-enforcer: the warn check for Bash could not finish; the call ran and its result is unchanged')
  expect(logLines(mods.writes).map((line) => [line.kind, line.event, line.tool])).toEqual([['check-failed', 'tool.result', 'Bash']])
})
