import { expect, test } from 'claude-code/testing'
import { sessionLogPath, stubMods } from './fake-io.ts'

const unfinished = '---\nname: finish-the-tests\nevent: stop\naction: block\npattern: TODO run tests\n---\nRun the test suite before you stop.\n'
const summary = '---\nname: summarize\nevent: stop\naction: warn\npattern: refactored\n---\nAsk Claude for a summary of the refactor.\n'
const blockMessage = '[cc-enforcer:project:finish-the-tests] Run the test suite before you stop.'
const transcriptPath = '/home/u/.claude/projects/repo/session-1.jsonl'
const agentTranscriptPath = '/home/u/.claude/projects/repo/agent-7.jsonl'

function setup(rules: Record<string, string>, extra: Record<string, string> = {}) {
  const files: Record<string, string> = { ...extra }
  for (const [name, text] of Object.entries(rules)) files[`/repo/.claude/hookify.${name}.local.md`] = text
  return { files, cwd: '/repo', dirs: ['/repo/.git'] }
}

function stop($, transcript_path = transcriptPath, last_assistant_message = 'All done.') {
  return $.classic.Stop({ stop_hook_active: false, transcript_path, last_assistant_message })
}

function subagentStop($, agent_id = 'agent-7') {
  return $.classic.SubagentStop({
    stop_hook_active: false,
    agent_id,
    agent_type: 'Explore',
    agent_transcript_path: agentTranscriptPath,
    last_assistant_message: 'Done.',
  })
}

function submitPrompt($) {
  return $.prompt.submit({ text: 'keep going', wait: false, origin: { kind: 'composer' } })
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('a matching block stop rule keeps Claude working and gives it the rule message', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: '{"text":"TODO run tests"}\n' }))
  const result = await stop($)
  expect(result.block).toBe(blockMessage)
  expect(mods.stops).toEqual([])
})

test('a non-matching stop lets the turn end', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: '{"text":"tests pass"}\n' }))
  const result = await stop($)
  expect(result.block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
})

test('a transcript over the read limit is matched through the last assistant message', async ($, on) => {
  const huge = 'x'.repeat(4 * 1024 * 1024 + 1)
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: huge }))
  const result = await stop($, transcriptPath, 'TODO run tests')
  expect(result.block).toBe(blockMessage)
  expect(mods.stops).toEqual([])
})

test('only the last 32 KB of the transcript is matched', async ($, on) => {
  const transcript = 'TODO run tests\n' + 'y'.repeat(32 * 1024)
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: transcript }))
  const result = await stop($)
  expect(result.block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
})

test('a matching warn stop rule lets the turn end and shows the user the message', async ($, on) => {
  const mods = stubMods(on, setup({ summary }, { [transcriptPath]: 'I refactored the parser.' }))
  const result = await stop($)
  expect(result.block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
  expect(mods.userLines.join('\n')).toContain('[cc-enforcer:project:summarize] Ask Claude for a summary of the refactor.')
})

test('after three consecutive blocks the turn ends and the user is told which rule kept blocking', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: 'TODO run tests' }))
  for (let attempt = 0; attempt < 3; attempt++) expect((await stop($)).block).toBe(blockMessage)
  const fourth = await stop($)
  expect(fourth.block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
  const report = mods.userLines.join('\n')
  expect(report).toContain('project:finish-the-tests')
  expect(report).toContain('three times')
})

test('a submitted prompt resets the loop counters', async ($, on) => {
  stubMods(on, setup({ unfinished }, { [transcriptPath]: 'TODO run tests' }))
  await stop($)
  await stop($)
  await submitPrompt($)
  for (let attempt = 0; attempt < 3; attempt++) expect((await stop($)).block).toBe(blockMessage)
  expect((await stop($)).block).toBeUndefined()
})

test('a stop that passes resets that agent counters', async ($, on) => {
  const files = setup({ unfinished }, { [transcriptPath]: 'TODO run tests', '/other.jsonl': 'clean' })
  stubMods(on, files)
  await stop($)
  await stop($)
  await stop($, '/other.jsonl')
  for (let attempt = 0; attempt < 3; attempt++) expect((await stop($)).block).toBe(blockMessage)
})

test('a subagent stop is checked against its own transcript like a main-session stop', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: 'clean', [agentTranscriptPath]: 'TODO run tests' }))
  expect((await subagentStop($)).block).toBe(blockMessage)
  expect((await stop($)).block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
})

test('each agent has its own loop counter', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }, { [transcriptPath]: 'TODO run tests', [agentTranscriptPath]: 'TODO run tests' }))
  for (let attempt = 0; attempt < 3; attempt++) expect((await subagentStop($)).block).toBe(blockMessage)
  expect((await stop($)).block).toBe(blockMessage)
  expect((await subagentStop($)).block).toBeUndefined()
  expect(mods.stops).toEqual(['agent-7'])
})

test('a stop check that fails lets the turn end and tells the user the check failed', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }))
  const result = await stop($)
  expect(result.block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
  expect(mods.userLines.join('\n')).toContain('check could not finish')
  await settled()
  const log = mods.writes.get(sessionLogPath('/repo')) ?? ''
  expect(log).toContain('"kind":"check-failed"')
  expect(log).toContain('"event":"stop"')
})

test('an all rule with a simple pattern applies at stop against the transcript', async ($, on) => {
  const everywhere = '---\nname: everywhere\nevent: all\naction: block\npattern: TODO run tests\n---\nRun the tests.\n'
  stubMods(on, setup({ everywhere }, { [transcriptPath]: 'TODO run tests' }))
  expect((await stop($)).block).toBe('[cc-enforcer:project:everywhere] Run the tests.')
})

test('an all rule with an evaluator condition is not applied at stop', async ($, on) => {
  const judged = '---\nname: judged\nevent: all\naction: block\nconditions:\n  - field: transcript\n    operator: llm_evaluate\n    pattern: Did Claude skip the tests?\n---\nRun the tests.\n'
  const mods = stubMods(on, setup({ judged }, { [transcriptPath]: 'TODO run tests' }))
  expect((await stop($)).block).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
})

test('a stop rule does not apply to tool calls', async ($, on) => {
  const mods = stubMods(on, setup({ unfinished }))
  const result = await $.tool.call({ tool: 'Bash', command: 'echo TODO run tests' })
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
})
