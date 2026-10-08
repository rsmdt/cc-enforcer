import { createCheck } from './check.ts'
import { MODS_OFF_GUIDANCE, OVERVIEW_COMMAND, overviewText, parseToggle, TOGGLE_COMMAND, TOGGLE_USAGE, toggleText } from './commands.ts'
import { review, type EvaluatorIo, type ReviewIo } from './evaluator/index.ts'
import { gateDecision } from './guards/gate.ts'
import { promptDecision } from './guards/prompt.ts'
import { bySource, createReviewer, queueKey } from './guards/reviewer.ts'
import { createTurnGuard, readTranscript } from './guards/turn.ts'
import { agentLabel, createRecorder, MAIN_SESSION_LABEL, toolTarget, WORKFLOW_AGENT_LABEL, type RecorderIo } from './recorder.ts'
import { findingMessage, ruleMessage, type Resolution, type ToolCallInput } from './rules/index.ts'
import { createRuleSources, hookifyEnabled, type SourceIo } from './sources/index.ts'

const TOOL_CALL_ENVELOPE = new Set(['tool', 'tool_use_id', 'agentId', 'consent'])

const sources = createRuleSources()
const check = createCheck()
const recorder = createRecorder()
const turnGuard = createTurnGuard()
const reviewer = createReviewer()
const MAIN_SESSION_KEY = 'main'
const COMMAND_FAILED = 'cc-enforcer: the command could not finish; no rule file was changed'
const PROMPT_KEY = 'prompt:main'
const PROMPT_CHECK_FAILED = 'cc-enforcer: the prompt check could not finish, so the prompt was sent'
const promptRuleCheckFailed = (ruleId: string) => `cc-enforcer: the check of rule ${ruleId} could not finish, so the prompt was sent`
const SEND_HINT = 'With text in the prompt box, press ctrl+x tab, then 1'
const STOP_CHECK_FAILED = 'cc-enforcer: the stop check could not finish, so the turn was allowed to end'
const turnOwner = (label: string) => (label === MAIN_SESSION_LABEL || label === WORKFLOW_AGENT_LABEL ? `the ${label}` : `the ${label} agent`)
const reviewFailed = (label: string) => `cc-enforcer: the review of ${turnOwner(label)} turn failed; nothing was sent to Claude`
const notReviewed = (label: string, count: number) => `cc-enforcer: ${count} ${count === 1 ? 'call' : 'calls'} of ${turnOwner(label)} ${count === 1 ? 'was' : 'were'} not reviewed`
const resultCheckFailed = (tool: string) => `cc-enforcer: the warn check for ${tool} could not finish; the call ran and its result is unchanged`

export function register(on) {
  on('session.start', async ($, e, next) => {
    await sources.current(sourceIo($), (rejection) => recorder.rejected(recorderIo($), rejection))
    await $.command.register({ name: OVERVIEW_COMMAND, description: `List cc-enforcer rules with their source, state and hits. ${MODS_OFF_GUIDANCE}` }).catch(() => undefined)
    await $.command.register({ name: TOGGLE_COMMAND, description: 'Switch a cc-enforcer rule on or off', argumentHint: TOGGLE_USAGE }).catch(() => undefined)
    const settings = await $.settings.read().catch(() => ({}))
    if (hookifyEnabled(settings.enabledPlugins)) recorder.hookifyAlsoEnabled(recorderIo($))
    return next(e)
  })

  on('command.run', async ($, e, next) => {
    const report = (rejection) => recorder.rejected(recorderIo($), rejection)
    if (e.command === OVERVIEW_COMMAND) {
      return { text: overviewText(await sources.overview(sourceIo($), report), recorder.hits) }
    }
    if (e.command === TOGGLE_COMMAND) {
      const request = parseToggle(e.args)
      if (request === undefined) return { text: toggleText(request) }
      return { text: toggleText(request, await sources.toggle(sourceIo($), report, request.name, request.enabled, request.source)) }
    }
    return next(e)
  }).catch(async ($, e, next) => {
    if (next.called || (e.command !== OVERVIEW_COMMAND && e.command !== TOGGLE_COMMAND)) return next(e)
    return { text: COMMAND_FAILED }
  })

  on('tool.call', async ($, e, next) => {
    const key = e.tool_use_id
    const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(recorderIo($), rejection))
    const input = toolCallInput(e)
    const resolution = await check.run('before-call', rules, input, evaluatorIo($), key)
    const decision = await gateDecision(resolution, (question, options) => $.ui.ask(question, options))
    if (decision === 'next') {
      check.settle(key)
      return reviewResult($, e, input, await next(e))
    }
    recordBlock($, e, input, resolution)
    check.settle(key)
    return decision
  }).catch(async ($, e, next) => {
    if (next.called) return next(e)
    recorder.record(recorderIo($), {
      kind: 'check-failed',
      event: 'tool.call',
      toolUseId: e.tool_use_id,
      tool: e.tool,
      agentLabel: e.agentId === undefined ? MAIN_SESSION_LABEL : WORKFLOW_AGENT_LABEL,
    })
    return { deny: check.backstop(e.tool_use_id) }
  })

  on('prompt.submit', async ($, e, next) => {
    turnGuard.reset()
    reportNotReviewed(recorderIo($), 'prompt', MAIN_SESSION_LABEL, reviewer.reset())
    const io = recorderIo($)
    const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(io, rejection))
    const resolution = await check.run('prompt', rules, { userPrompt: e.text }, evaluatorIo($), PROMPT_KEY)
    const decision = promptDecision(resolution)
    recordPrompt(io, resolution)
    check.settle(PROMPT_KEY)
    if (decision !== 'next' && 'drop' in decision) return decision
    reportPromptSoftFailures(io, resolution)
    if (decision === 'next') return next(e)
    return next({ ...e, context: [...(e.context ?? []), decision.context] })
  }).catch(async ($, e, next) => {
    if (next.called) return next(e)
    const io = recorderIo($)
    const drop = check.promptBackstop(PROMPT_KEY)
    recorder.record(io, { kind: 'check-failed', event: 'prompt', agentLabel: MAIN_SESSION_LABEL })
    if (drop !== undefined) return { drop }
    io.showUser(PROMPT_CHECK_FAILED)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await reviewTurn($, e.agentId)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const findings = reviewer.pending()
    if (findings.length === 0 || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return h(
      Box,
      { flexDirection: 'column' },
      h(Text, null, findings.join('\n\n')),
      h(Text, { dimColor: true }, SEND_HINT),
      h(
        Box,
        { flexDirection: 'row' },
        h(Button, { key: 'send', label: 'Send to Claude', hotkey: '1', variant: 'primary', onPress: () => sendFindings($) }),
        h(Button, { key: 'dismiss', label: 'Dismiss', hotkey: '0', role: 'dismiss', onPress: () => clearFindings($) }),
      ),
    )
  })

  on('classic.Stop', ($, e, next) =>
    guardStop($, e, next, { agent: MAIN_SESSION_KEY, label: MAIN_SESSION_LABEL, transcriptPath: e.transcript_path }),
  ).catch(async ($, e, next) => {
    if (next.called) return next(e)
    reportStopCheckFailed(recorderIo($), MAIN_SESSION_LABEL)
    return next(e)
  })

  on('classic.SubagentStop', ($, e, next) =>
    guardStop($, e, next, { agent: e.agent_id, label: e.agent_type ?? WORKFLOW_AGENT_LABEL, transcriptPath: e.agent_transcript_path }),
  ).catch(async ($, e, next) => {
    if (next.called) return next(e)
    reportStopCheckFailed(recorderIo($), e.agent_type ?? WORKFLOW_AGENT_LABEL)
    return next(e)
  })
}

async function reviewResult($, e, input: ToolCallInput, result) {
  if (result.deny !== undefined) return result
  const io = recorderIo($)
  try {
    const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(io, rejection))
    const resolution = check.runAfterCall(rules, input)
    if (resolution.deferred.length > 0) {
      reviewer.queue(queueKey(e.agentId), { toolUseId: e.tool_use_id, tool: input.tool, target: toolTarget(input.tool, input.args), items: resolution.deferred })
    }
    if (resolution.action !== 'warn') return result
    const label = await callerLabel($, e.agentId)
    const shared = { event: 'tool.result', toolUseId: e.tool_use_id, tool: input.tool, target: toolTarget(input.tool, input.args), agentLabel: label }
    for (const rule of resolution.rules) {
      recorder.shown(io, ruleMessage(rule), { kind: 'finding', ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
    }
    return { ...result, context: [...(result.context ?? []), ...resolution.rules.map(ruleMessage)] }
  } catch {
    recorder.shown(io, resultCheckFailed(input.tool), { kind: 'check-failed', event: 'tool.result', toolUseId: e.tool_use_id, tool: input.tool })
    return result
  }
}

async function reviewTurn($, agentId: string | undefined): Promise<void> {
  const { calls, notReviewed: overflow } = reviewer.take(queueKey(agentId))
  if (calls.length === 0 && overflow === 0) return
  const io = recorderIo($)
  const label = await callerLabel($, agentId)
  reportNotReviewed(io, 'turn.complete', label, overflow)
  try {
    const surfaces = await $.session.surfaces()
    const shown: string[] = []
    for (const batch of bySource(calls)) {
      const findings = await review(batch, reviewIo($))
      if (findings === undefined) {
        reportReviewFailed(io, label)
        continue
      }
      for (const { ruleId, toolUseId, finding } of findings) {
        const call = batch.find((queued) => queued.toolUseId === toolUseId)!
        const rule = call.items.find((item) => item.ruleId === ruleId)!.rule
        const message = findingMessage(rule, call.tool, call.target, finding)
        const event = { kind: 'review-finding', ruleId, ruleName: rule.name, action: rule.action, event: 'turn.complete', toolUseId, tool: call.tool, target: call.target, agentLabel: label } as const
        if (surfaces.length === 0) {
          recorder.record(io, event)
        } else {
          recorder.shown(io, message, event)
          shown.push(message)
        }
      }
    }
    if (shown.length > 0) {
      reviewer.show(shown)
      $.ui.invalidate('ui.render')
    }
  } catch {
    reportReviewFailed(io, label)
  }
  await recorder.flush()
}

async function sendFindings($): Promise<void> {
  const findings = reviewer.pending().join('\n\n')
  const draft = await $.prompt.read()
  const filled = await $.prompt.fill({ text: draft.text === '' ? findings : `\n\n${findings}`, mode: 'append' })
  if (filled.isFilled) clearFindings($)
}

function clearFindings($): void {
  reviewer.clear()
  $.ui.invalidate('ui.render')
}

function reportNotReviewed(io: RecorderIo, event: string, label: string, count: number): void {
  if (count === 0) return
  recorder.shown(io, notReviewed(label, count), { kind: 'not-reviewed', event, agentLabel: label, count })
}

function reportReviewFailed(io: RecorderIo, label: string): void {
  recorder.shown(io, reviewFailed(label), { kind: 'review-failed', event: 'turn.complete', agentLabel: label })
}

async function callerLabel($, agentId: string | undefined): Promise<string> {
  const agents = agentId === undefined ? [] : await $.agent.list().catch(() => [])
  return agentLabel(agentId, agents)
}

type StopTarget = { agent: string; label: string; transcriptPath: string | undefined }

async function guardStop($, e, next, target: StopTarget) {
  const io = recorderIo($)
  const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(io, rejection))
  const transcript = await readTranscript({ stat: (path) => $.fs.stat(path), read: (path) => $.fs.read(path) }, target.transcriptPath, e.last_assistant_message)
  const { resolution, overridden } = check.runStop(rules, { transcript }, turnGuard.atLimit(target.agent))
  const shared = { event: 'stop', agentLabel: target.label }
  for (const rule of overridden) {
    io.showUser(`cc-enforcer: the rule ${rule.id} kept Claude working three times in a row, so the turn was allowed to end`)
    recorder.record(io, { kind: 'loop-guard-override', ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
  }
  if (resolution.action === 'block') {
    turnGuard.blocked(target.agent, resolution.rules.map((rule) => rule.id))
    for (const rule of resolution.rules) recorder.record(io, { kind: 'block', ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
    return { block: resolution.message }
  }
  turnGuard.ended(target.agent)
  if (resolution.action === 'warn') {
    io.showUser(resolution.message)
    for (const rule of resolution.rules) recorder.record(io, { kind: 'warn', ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
  }
  return next(e)
}

function recordPrompt(io: RecorderIo, resolution: Resolution): void {
  const shared = { event: 'prompt', agentLabel: MAIN_SESSION_LABEL }
  if (resolution.action === 'block' || resolution.action === 'warn') {
    for (const rule of resolution.rules) recorder.record(io, { kind: resolution.action, ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
  }
  if (resolution.action === 'block') {
    for (const rule of resolution.failures) recorder.record(io, { kind: 'check-failed', ruleId: rule.id, ruleName: rule.name, action: rule.action, ...shared })
  }
}

function reportPromptSoftFailures(io: RecorderIo, resolution: Resolution): void {
  for (const rule of resolution.softFailures) {
    recorder.shown(io, promptRuleCheckFailed(rule.id), { kind: 'check-failed', ruleId: rule.id, ruleName: rule.name, action: rule.action, event: 'prompt', agentLabel: MAIN_SESSION_LABEL })
  }
}

function reportStopCheckFailed(io: RecorderIo, label: string): void {
  io.showUser(STOP_CHECK_FAILED)
  recorder.record(io, { kind: 'check-failed', event: 'stop', agentLabel: label })
}

function sourceIo($): SourceIo {
  return {
    cwd: () => $.session.cwd(),
    home: () => homeFolder($),
    list: (dir) => $.fs.list(dir),
    stat: (path) => $.fs.stat(path),
    read: (path) => $.fs.read(path),
    exists: (path) => $.fs.exists(path),
    git: (args, cwd) => $.process.run(['git', ...args], { cwd }),
    write: (path, text) => $.fs.write(path, text),
  }
}

function evaluatorIo($): EvaluatorIo {
  return {
    classify: (text, labels) => $.model.classify(text, labels),
    sleep: (ms, signal) => $.clock.sleep(ms, { signal }),
  }
}

function reviewIo($): ReviewIo {
  return {
    complete: (request) => $.model.complete(request),
  }
}

function recorderIo($): RecorderIo {
  return {
    home: () => homeFolder($),
    sessionId: () => $.session.id(),
    write: (path, text) => $.fs.write(path, text),
    run: (argv) => $.process.run(argv),
    showUser: (text) => $.ui.log(text),
  }
}

async function homeFolder($): Promise<string> {
  const home = await $.env.get('HOME')
  if (!home) throw new Error('HOME is not set')
  return home
}

function toolCallInput(e): ToolCallInput {
  const args: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(e)) {
    if (!TOOL_CALL_ENVELOPE.has(key)) args[key] = value
  }
  return { tool: e.tool, args }
}

function recordBlock($, e, input: ToolCallInput, resolution: Resolution): void {
  const io = recorderIo($)
  const shared = { event: 'tool.call', toolUseId: e.tool_use_id, tool: input.tool, target: toolTarget(input.tool, input.args) }
  const agents = e.agentId === undefined ? Promise.resolve([]) : $.agent.list().catch(() => [])
  void agents.then((list) => {
    const label = agentLabel(e.agentId, list)
    for (const rule of resolution.rules) {
      recorder.record(io, { kind: 'block', ruleId: rule.id, ruleName: rule.name, action: rule.action, agentLabel: label, ...shared })
    }
    for (const rule of resolution.failures) {
      recorder.record(io, { kind: 'check-failed', ruleId: rule.id, ruleName: rule.name, action: rule.action, agentLabel: label, ...shared })
    }
  })
}
