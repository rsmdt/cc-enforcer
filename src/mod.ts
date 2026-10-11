import { activityDetail, activityRecord, activityTarget, activityTime, badgeText, cardRowCount, CHECKED_STYLE, createActivity, KIND_ICON, KIND_STYLE, kindOf, labelledCardsWidth, logWindow, operationOf, scrolledTop, statCards, statusLine, type Activity, type ActivityRecord } from './activity.ts'
import { createCheck } from './check.ts'
import { CLEANUP_COMMAND, CLEANUP_HINT, CLEANUP_USAGE, cleanupLogs, parsePeriod } from './cleanup.ts'
import { AUDIT_COMMAND, MODS_OFF_GUIDANCE, OVERVIEW_COMMAND, overviewText, parseToggle, TOGGLE_COMMAND, TOGGLE_USAGE, toggleText } from './commands.ts'
import { review, type EvaluatorIo, type ReviewIo } from './evaluator/index.ts'
import { gateDecision } from './guards/gate.ts'
import { promptDecision } from './guards/prompt.ts'
import { bySource, createReviewer, queueKey } from './guards/reviewer.ts'
import { createTurnGuard, readTranscript } from './guards/turn.ts'
import { agentLabel, createRecorder, logRoot, MAIN_SESSION_LABEL, toolTarget, WORKFLOW_AGENT_LABEL, type RecorderIo } from './recorder.ts'
import { coveringRules, findingMessage, ruleMessage, type Resolution, type ToolCallInput } from './rules/index.ts'
import { createRuleSources, hookifyEnabled, type SourceIo } from './sources/index.ts'

const TOOL_CALL_ENVELOPE = new Set(['tool', 'tool_use_id', 'agentId', 'consent'])

const sources = createRuleSources()
const check = createCheck()
const recorder = createRecorder()
const turnGuard = createTurnGuard()
const reviewer = createReviewer()
const activity = createActivity()
const AUDIT_PANE = AUDIT_COMMAND
const PANE_HEADLINE = 'CC Enforcer'
const NOTHING_CHECKED = 'No calls checked yet. Each tool call cc-enforcer checks appears here.'
let ruleEventCount = 0
let logTop: number | undefined
let logRows = 1
const FIXED_HEADER_ROWS = 3
const CARD_ROWS = 3
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
    await $.command.register({ name: AUDIT_COMMAND, description: 'Open or close the cc-enforcer audit pane' }).catch(() => undefined)
    await $.command.register({ name: CLEANUP_COMMAND, description: 'Delete cc-enforcer session logs older than a period (default 180 days)', argumentHint: CLEANUP_HINT }).catch(() => undefined)
    await restoreActivity($)
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
    if (e.command === AUDIT_COMMAND) {
      await restoreActivity($)
      return { text: await toggleAuditPane($) }
    }
    if (e.command === CLEANUP_COMMAND) return { text: await cleanup($, e.args) }
    return next(e)
  }).catch(async ($, e, next) => {
    if (next.called || ![OVERVIEW_COMMAND, TOGGLE_COMMAND, AUDIT_COMMAND, CLEANUP_COMMAND].includes(e.command)) return next(e)
    return { text: COMMAND_FAILED }
  })

  on('tool.call', async ($, e, next) => {
    const key = e.tool_use_id
    const input = toolCallInput(e)
    await restoreActivity($)
    activity.start(key, queueKey(e.agentId), input.tool, operationOf(input), 'checking', undefined, { input: input.args, agentId: e.agentId })
    redraw($)
    const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(recorderIo($), rejection))
    const resolution = await check.run('before-call', rules, input, evaluatorIo($), key)
    activity.note(key, { covering: coveringRules(rules, input), matched: resolution.rules.map((rule) => rule.id) })
    const decision = await gateDecision(resolution, (question, options) => $.ui.ask(question, options))
    if (decision === 'next') {
      activity.settle(key, resolution.action === 'ask' ? 'allowed by you' : activity.get(key)?.covering?.length ? 'approved' : 'ignored')
      redraw($)
      check.settle(key)
      return reviewResult($, e, input, await next(e))
    }
    activity.settle(key, resolution.action === 'ask' ? 'denied by you' : 'blocked', decision.deny)
    redraw($)
    recordBlock($, e, input, resolution)
    check.settle(key)
    return decision
  }).catch(async ($, e, next) => {
    if (next.called) return next(e)
    const deny = check.backstop(e.tool_use_id)
    activity.settle(e.tool_use_id, 'check failed', deny)
    redraw($)
    recorder.record(recorderIo($), {
      kind: 'check-failed',
      event: 'tool.call',
      toolUseId: e.tool_use_id,
      tool: e.tool,
      agentLabel: e.agentId === undefined ? MAIN_SESSION_LABEL : WORKFLOW_AGENT_LABEL,
    })
    return { deny }
  })

  on('prompt.submit', async ($, e, next) => {
    turnGuard.reset()
    reportNotReviewed(recorderIo($), 'prompt', MAIN_SESSION_LABEL, reviewer.reset())
    activity.expireQueued(queueKey(undefined))
    redraw($)
    const io = recorderIo($)
    const rules = await sources.current(sourceIo($), (rejection) => recorder.rejected(io, rejection))
    const resolution = await check.run('prompt', rules, { userPrompt: e.text }, evaluatorIo($), PROMPT_KEY)
    const decision = promptDecision(resolution)
    recordPrompt(io, resolution, e.text)
    noteRuleEvent($, queueKey(undefined), 'prompt', resolution)
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

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const entry = activity.get(e.props.tool_use_id)
    if (entry === undefined || entry.status === 'ignored') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return h(Box, { flexDirection: 'column' }, await next(e), h(Text, { key: 'cc-enforcer-badge', ...statusStyle(entry) }, badgeText(entry)))
  })

  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
    const isNotable = e.props.calls.some((call) => {
      const entry = call.tool_use_id === undefined ? undefined : activity.get(call.tool_use_id)
      return entry !== undefined && (kindOf(entry.status) === 'rejected' || kindOf(entry.status) === 'cautioned')
    })
    if (!isNotable || e.props.isExpanded) return next(e)
    return next({ ...e, props: { ...e.props, isExpanded: true } })
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== AUDIT_PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const entries = activity.list()
    const cards = statCards(activity.totals(), e.props.bodyColumns)
    const heading = h(
      Box,
      { key: 'heading', flexDirection: 'column', marginBottom: 1 },
      h(Text, { bold: true }, PANE_HEADLINE),
      h(
        Box,
        { flexDirection: 'row', flexWrap: 'wrap', columnGap: 1 },
        ...cards.map(({ kind, lines }) =>
          h(Box, { key: `card:${kind}`, flexDirection: 'column' }, ...lines.map((line) => h(Text, kind === 'checked' ? CHECKED_STYLE : KIND_STYLE[kind], line))),
        ),
      ),
    )
    if (entries.length === 0) return h(Box, { flexDirection: 'column' }, heading, h(Text, { dimColor: true }, NOTHING_CHECKED))
    logRows = Math.max(1, e.props.scroll.bodyRows - FIXED_HEADER_ROWS - CARD_ROWS * cardRowCount(cards, e.props.bodyColumns))
    const { start, end, older, newer } = logWindow(entries, logTop, logRows)
    const position = [older > 0 ? `↑ ${older} older` : '', newer > 0 ? `↓ ${newer} newer` : ''].filter(Boolean).join('  ')
    return h(
      Box,
      { flexDirection: 'column' },
      heading,
      h(Text, { bold: true }, position === '' ? `Log · ${entries.length} events` : `Log · ${entries.length} events  ${position}`),
      ...entries.slice(start, end).flatMap((entry, offset) => {
        const index = start + offset
        const kind = kindOf(entry.status)
        const style = KIND_STYLE[kind]
        const detail = activityDetail(entry)
        return [
          h(
            Box,
            { key: `row:${index}`, flexDirection: 'row', gap: 1 },
            h(Box, { flexShrink: 0 }, h(Text, { dimColor: true }, activityTime(entry))),
            h(Box, { flexShrink: 0 }, h(Text, style, KIND_ICON[kind])),
            h(Text, { ...(kind === 'ignored' ? style : {}), wrap: 'truncate-end' }, activityTarget(entry)),
          ),
          ...(detail === undefined ? [] : [h(Box, { key: `detail:${index}`, paddingLeft: 11 }, h(Text, { ...style, wrap: 'truncate-end' }, detail))]),
        ]
      }),
    )
  })

  on('ui.scroll', { requestId: AUDIT_PANE }, ($, e) => {
    logTop = scrolledTop(activity.list(), logTop, e.by, logRows)
    $.ui.invalidate('ui.render')
    return {}
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
      activity.settle(e.tool_use_id, 'queued for review')
      redraw($)
    }
    if (resolution.action !== 'warn') return result
    activity.settle(e.tool_use_id, 'warned', resolution.rules.map(ruleMessage).join('\n'))
    redraw($)
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
  const queue = queueKey(agentId)
  const { calls, notReviewed: overflow } = reviewer.take(queue)
  if (calls.length === 0 && overflow === 0) return
  for (const call of calls) markIf(call.toolUseId, 'queued for review', 'reviewing')
  redraw($)
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
        for (const call of batch) markIf(call.toolUseId, 'reviewing', 'review failed')
        continue
      }
      for (const { ruleId, toolUseId, finding } of findings) {
        const call = batch.find((queued) => queued.toolUseId === toolUseId)!
        const rule = call.items.find((item) => item.ruleId === ruleId)!.rule
        const message = findingMessage(rule, call.tool, call.target, finding)
        activity.settle(toolUseId, 'flagged', message)
        const event = { kind: 'review-finding', ruleId, ruleName: rule.name, action: rule.action, event: 'turn.complete', toolUseId, tool: call.tool, target: call.target, agentLabel: label } as const
        if (surfaces.length === 0) {
          recorder.record(io, event)
        } else {
          recorder.shown(io, message, event)
          shown.push(message)
        }
      }
      for (const call of batch) markIf(call.toolUseId, 'reviewing', 'approved')
    }
    if (shown.length > 0) reviewer.show(shown)
  } catch {
    reportReviewFailed(io, label)
    for (const call of calls) markIf(call.toolUseId, 'reviewing', 'review failed')
  }
  activity.expireQueued(queue)
  redraw($)
  await recorder.flush()
}

function markIf(id: string, current: Activity['status'], next: Activity['status']): void {
  if (activity.get(id)?.status === current) activity.settle(id, next, activity.get(id)?.reason)
}

function redraw($): void {
  const io = recorderIo($)
  for (const entry of activity.drainChanges()) recorder.record(io, activityRecord(entry))
  $.ui.invalidate('ui.render')
  $.ui.status(statusLine(activity.totals()))
}

function statusStyle(entry: Activity): { color?: string; dimColor?: boolean } {
  const kind = kindOf(entry.status)
  return kind === 'rejected' || kind === 'cautioned' ? KIND_STYLE[kind] : { dimColor: true }
}

function noteRuleEvent($, queue: string, subject: string, resolution: Resolution): void {
  if (resolution.action !== 'block' && resolution.action !== 'warn') return
  ruleEventCount++
  activity.start(`${subject}:${ruleEventCount}`, queue, subject, undefined, resolution.action === 'block' ? 'blocked' : 'warned', resolution.message)
  redraw($)
}

let restoring: Promise<void> | undefined

function restoreActivity($): Promise<void> {
  restoring ??= recorder
    .earlier(recorderIo($))
    .then((events) => {
      activity.restore(events.filter((event) => event.kind === 'activity') as unknown as ActivityRecord[])
      redraw($)
    })
    .catch(() => {
      restoring = undefined
    })
  return restoring
}

async function cleanup($, args: string): Promise<string> {
  const days = parsePeriod(args)
  if (days === undefined) return CLEANUP_USAGE
  const io = recorderIo($)
  const [home, currentLog] = await Promise.all([homeFolder($), recorder.logPath(io).catch(() => '')])
  return cleanupLogs(
    {
      list: (dir) => $.fs.list(dir),
      modifiedAt: async (path) => (await $.fs.stat(path)).mtimeMs,
      confirm: async (question) => (await $.ui.ask(question, { options: ['Delete', 'Keep'], header: 'cc-enforcer' }).catch(() => 'Keep')) === 'Delete',
      remove: async (paths) => void (await $.process.run(['rm', '-f', ...paths])),
    },
    logRoot(home),
    currentLog,
    days,
    Date.now(),
  )
}

async function toggleAuditPane($): Promise<string> {
  const isOpen = (await $.ui.panes()).some((pane) => pane.id === AUDIT_PANE)
  if (isOpen) {
    await $.ui.close({ id: AUDIT_PANE })
    return 'Audit pane closed'
  }
  await $.ui.open({ id: AUDIT_PANE, title: 'cc-enforcer audit', columns: labelledCardsWidth() })
  return 'Audit pane opened'
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
  recorder.record(io, { kind: 'turn-end', agentLabel: target.label, outcome: resolution.action, ruleIds: resolution.rules.map((rule) => rule.id) })
  noteRuleEvent($, target.agent === MAIN_SESSION_KEY ? queueKey(undefined) : target.agent, 'turn end', resolution)
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

function recordPrompt(io: RecorderIo, resolution: Resolution, text: string): void {
  recorder.record(io, { kind: 'prompt', text, outcome: resolution.action, ruleIds: resolution.rules.map((rule) => rule.id) })
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
    cwd: () => $.session.cwd(),
    read: (path) => $.fs.read(path),
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
