import { expect, mock, test } from 'claude-code/testing'
import { ruleEvents, stubMods } from './fake-io.ts'

const confirmPush = '---\nname: confirm-push\nevent: bash\naction: ask\npattern: git push\n---\nPushing shares your work; check the branch first.\n'
const forcePush = '---\nname: no-force-push\nevent: bash\naction: block\npattern: --force\n---\nNever force-push.\n'
const confirmMain = '---\nname: confirm-main\nevent: bash\naction: ask\npattern: origin main\n---\nThis pushes to main.\n'
const askMessage = '[cc-enforcer:project:confirm-push] Pushing shares your work; check the branch first.'

function setup(rules: Record<string, string>, answerAsk?: (question: string, labels: readonly string[]) => Promise<string>) {
  const files: Record<string, string> = {}
  for (const [name, text] of Object.entries(rules)) files[`/repo/.claude/hookify.${name}.local.md`] = text
  return { files, cwd: '/repo', dirs: ['/repo/.git'], answerAsk }
}

function logLines(writes: Map<string, string>) {
  return ruleEvents(writes, '/repo')
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const allow = async (question: string, labels: readonly string[]) => labels[0]

test('a matching ask rule asks the user, naming the rule and showing its message', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }, allow))
  await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(mods.asked.length).toBe(1)
  const [{ question, header, labels }] = mods.asked
  expect(question).toContain('confirm-push')
  expect(question).toContain('Pushing shares your work; check the branch first.')
  expect(question.endsWith('?')).toBe(true)
  expect(header.length).toBeLessThanOrEqual(12)
  expect(labels.length).toBe(2)
})

test('when the user allows it the call runs', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }, allow))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.result).toBe('ran')
  expect(mods.toolCalls).toEqual(['Bash'])
  await settled()
  expect(logLines(mods.writes)).toEqual([])
})

test('when the user declines the call does not run and Claude gets the rule message', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }, async (question, labels) => labels[1]))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.deny).toBe(askMessage)
  expect(mods.toolCalls).toEqual([])
  await settled()
  expect(logLines(mods.writes).map((line) => [line.ruleId, line.action])).toEqual([['project:confirm-push', 'ask']])
})

test('when the user dismisses the question the call does not run and Claude gets the rule message', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }, async () => {
    throw new Error('dismissed')
  }))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.deny).toBe(askMessage)
  expect(mods.toolCalls).toEqual([])
})

test('a free-text answer is not taken as approval', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }, async () => 'sure, go ahead'))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.deny).toBe(askMessage)
  expect(mods.toolCalls).toEqual([])
})

test('in a non-interactive run a matching ask rule stops the call and Claude gets the rule message', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  expect(result.deny).toBe(askMessage)
  expect(mods.toolCalls).toEqual([])
})

test('a call that matches no ask rule runs without asking', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush }))
  const result = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(result.result).toBe('ran')
  expect(mods.asked).toEqual([])
})

test('a block rule that also matches wins without asking', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush, forcePush }, allow))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  expect(result.deny).toBe('[cc-enforcer:project:no-force-push] Never force-push.')
  expect(mods.asked).toEqual([])
  expect(mods.toolCalls).toEqual([])
})

test('several matching ask rules are asked about in one question', async ($, on) => {
  const mods = stubMods(on, setup({ confirmPush, confirmMain }, async (question, labels) => labels[1]))
  const result = await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(mods.asked.length).toBe(1)
  expect(mods.asked[0].question).toContain('confirm-push')
  expect(mods.asked[0].question).toContain('confirm-main')
  expect(result.deny).toContain(askMessage)
  expect(result.deny).toContain('[cc-enforcer:project:confirm-main] This pushes to main.')
})

test('waiting on the user past the hook time limit still lets the call run once allowed', async ($, on) => {
  const clock = mock.clock(on)
  let answer: (label: string) => void = () => {}
  const mods = stubMods(on, setup({ confirmPush }, () => new Promise((resolve) => (answer = resolve))))
  const pending = $.tool.call({ tool: 'Bash', command: 'git push origin feature' })
  await settled()
  await clock.advance(15000)
  answer(mods.asked[0].labels[0])
  const result = await pending
  expect(result.result).toBe('ran')
})

test('an ask rule on the stop event is reported invalid at session start', async ($, on) => {
  const mods = stubMods(on, setup({ askStop: '---\nname: ask-stop\nevent: stop\naction: ask\npattern: x\n---\nb\n' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo' })
  const report = mods.userLines.join('\n')
  expect(report).toContain('/repo/.claude/hookify.askStop.local.md')
  expect(report).toContain('ask')
})

test('an ask rule on the prompt event is reported invalid at session start', async ($, on) => {
  const mods = stubMods(on, setup({ askPrompt: '---\nname: ask-prompt\nevent: prompt\naction: ask\npattern: x\n---\nb\n' }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/repo' })
  const report = mods.userLines.join('\n')
  expect(report).toContain('/repo/.claude/hookify.askPrompt.local.md')
  expect(report).toContain('ask')
})

test('an all rule with action ask is not applied at a stop', async ($, on) => {
  const transcriptPath = '/home/u/.claude/projects/repo/session-1.jsonl'
  const askAll = '---\nname: ask-all\nevent: all\naction: ask\npattern: deploy\n---\nConfirm deploys.\n'
  const mods = stubMods(on, { ...setup({ askAll }, allow), files: { ...setup({ askAll }).files, [transcriptPath]: '{"text":"deploy now"}\n' } })
  const result = await $.classic.Stop({ stop_hook_active: false, transcript_path: transcriptPath, last_assistant_message: 'deploy now' })
  expect(result.decision).toBeUndefined()
  expect(mods.stops).toEqual(['main session'])
  expect(mods.asked).toEqual([])
})

test('an all rule with action ask is not applied to a prompt', async ($, on) => {
  const askAll = '---\nname: ask-all\nevent: all\naction: ask\npattern: deploy\n---\nConfirm deploys.\n'
  const mods = stubMods(on, setup({ askAll }, allow))
  const result = await $.prompt.submit({ text: 'deploy now', wait: false, origin: { kind: 'composer' } })
  expect(result.text).toBe('deploy now')
  expect(mods.asked).toEqual([])
})
