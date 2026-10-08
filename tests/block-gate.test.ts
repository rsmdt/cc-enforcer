import { expect, test } from 'claude-code/testing'
import { stubMods } from './fake-io.ts'

const forcePush = '---\nname: no-force-push\nevent: bash\naction: block\npattern: git push .*--force\n---\nNever force-push. Push to a new branch and open a pull request.\n'
const envWrites = '---\nevent: file\naction: block\nconditions:\n  - field: file_path\n    operator: ends_with\n    pattern: .env\n---\nKeep secrets out of .env files; use the vault.\n'
const blockMessage = '[cc-enforcer:project:no-force-push] Never force-push. Push to a new branch and open a pull request.'

const repo = {
  files: {
    '/repo/.claude/hookify.no-force-push.local.md': forcePush,
    '/home/u/.claude/hookify.no-env-writes.local.md': envWrites,
  },
  cwd: '/repo/packages/app',
  dirs: ['/repo/.git'],
}

function logLines(writes: Map<string, string>) {
  const text = writes.get('/home/u/.cc-enforcer/logs/session-1.jsonl') ?? ''
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('a matching main-session call does not run and Claude gets the rule name and message', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin main --force' })
  expect(result.deny).toBe(blockMessage)
  expect(mods.toolCalls).toEqual([])
})

test('a matching subagent call does not run and the subagent gets the same message', async ($, on) => {
  const mods = stubMods(on, { ...repo, agents: [{ id: 'agent-7', type: 'Explore', description: 'look around', status: 'running' }] })
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force', agentId: 'agent-7' })
  expect(result.deny).toBe(blockMessage)
  expect(mods.toolCalls).toEqual([])
  await settled()
  expect(logLines(mods.writes)[0].agentLabel).toBe('Explore')
})

test('a call from an agent Claude Code cannot name is blocked and logged as a workflow agent', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force', agentId: 'wf-123' })
  expect(result.deny).toBe(blockMessage)
  await settled()
  expect(logLines(mods.writes)[0].agentLabel).toBe('workflow agent')
})

test('a non-matching call runs unaffected', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
  await settled()
  expect(logLines(mods.writes)).toEqual([])
})

test('a personal file rule blocks a Write and the log keeps the path but no content or command', async ($, on) => {
  const mods = stubMods(on, repo)
  const result = await $.tool.call({ tool: 'Write', file_path: '/repo/.env', content: 'API_KEY=secret-value' })
  expect(result.deny).toBe('[cc-enforcer:personal:no-env-writes] Keep secrets out of .env files; use the vault.')
  await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  await settled()
  const lines = logLines(mods.writes)
  expect(lines.map((line) => [line.kind, line.ruleId, line.tool, line.target, line.agentLabel])).toEqual([
    ['block', 'personal:no-env-writes', 'Write', '/repo/.env', 'main session'],
    ['block', 'project:no-force-push', 'Bash', undefined, 'main session'],
  ])
  const written = [...mods.writes.values()].join('\n')
  expect(written).not.toContain('secret-value')
  expect(written).not.toContain('git push')
})

test('the session log is made owner-only before anything is written to it, and only once', async ($, on) => {
  const mods = stubMods(on, repo)
  await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  await $.tool.call({ tool: 'Bash', command: 'git push -f --force' })
  await settled()
  const log = '/home/u/.cc-enforcer/logs/session-1.jsonl'
  expect(mods.logFileSteps).toEqual([
    `run sh -c umask 077 && mkdir -p "$1" && chmod 700 "$2" "$1" && : >> "$3" && chmod 600 "$3" sh /home/u/.cc-enforcer/logs /home/u/.cc-enforcer ${log}`,
    `write ${log}`,
    `write ${log}`,
  ])
})

test('when the log cannot be made owner-only it is still written', async ($, on) => {
  const mods = stubMods(on, { ...repo, failing: ['process.run'] })
  await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  await settled()
  expect(logLines(mods.writes).map((line) => line.ruleId)).toEqual(['project:no-force-push'])
})

test('outside a git repository a rule in a parent folder with a stray .git does not apply', async ($, on) => {
  const mods = stubMods(on, {
    files: { '/top/.claude/hookify.no-force-push.local.md': forcePush, '/top/.git': '' },
    cwd: '/top/sub',
    git: 'not-a-repo',
  })
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
})

test('at session start an invalid file is reported to the user and the other rules still apply', async ($, on) => {
  const mods = stubMods(on, {
    ...repo,
    files: { ...repo.files, '/repo/.claude/hookify.broken.local.md': '---\nevent: bash\naction: deny\npattern: x\n---\nb\n' },
  })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo/packages/app' })
  const report = mods.userLines.join('\n')
  expect(report).toContain('/repo/.claude/hookify.broken.local.md')
  expect(report).toContain('unknown action "deny"')
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  expect(result.deny).toBe(blockMessage)
})

test('if the enforcer fails before deciding, the call does not run', async ($, on) => {
  const mods = stubMods(on, { ...repo, failing: ['session.cwd'] })
  const result = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(result.deny).toBe('[cc-enforcer] the check could not finish, so this was not run')
  expect(mods.toolCalls).toEqual([])
  await settled()
  expect(logLines(mods.writes).map((line) => [line.kind, line.tool, line.agentLabel])).toEqual([['check-failed', 'Bash', 'main session']])
})

test('a block rule whose plain-language check cannot be answered stops the call and names the rule', async ($, on) => {
  const evaluator = '---\nevent: file\naction: block\nconditions:\n  - field: file_path\n    operator: contains\n    pattern: migrations/\n  - field: new_text\n    operator: llm_evaluate\n    pattern: Does this change an existing migration?\n---\nAdd a new migration.\n'
  const mods = stubMods(on, { ...repo, files: { '/repo/.claude/hookify.migrations.local.md': evaluator } })
  const result = await $.tool.call({ tool: 'Edit', file_path: 'db/migrations/1.sql', old_string: 'a', new_string: 'b' })
  expect(result.deny).toBe('[cc-enforcer:project:migrations] the check could not finish, so this was not run')
  expect(mods.toolCalls).toEqual([])
})
