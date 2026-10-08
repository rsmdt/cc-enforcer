import type { RuleSource } from './rules/index.ts'
import type { Overview, ToggleOutcome } from './sources/index.ts'

export const OVERVIEW_COMMAND = 'cc-enforcer-rules'
export const TOGGLE_COMMAND = 'cc-enforcer-toggle'
export const TOGGLE_USAGE = '<name> on|off [project|personal]'

export const MODS_OFF_GUIDANCE =
  'If rules stop applying, Claude Code may have switched mods off for this session. Look for its notice in the transcript and for the `mods active` line in /plugin, then run /reload-plugins to restore enforcement.'

export type ToggleRequest = { name: string; enabled: boolean; source?: RuleSource }

const SWITCH_WORDS: Record<string, boolean> = { on: true, off: false }
const SOURCES: readonly RuleSource[] = ['project', 'personal']

export function overviewText(overview: Overview, hits: (ruleId: string) => number): string {
  const folders = `the project folder ${overview.projectFolder} or the personal folder ${overview.personalFolder}`
  if (overview.rules.length === 0) {
    return [`No rules are active. Place rule files named hookify.<name>.local.md in ${folders}.`, '', MODS_OFF_GUIDANCE].join('\n')
  }
  const rows = overview.rules.map((rule) =>
    [
      rule.name,
      `event: ${rule.event}`,
      `action: ${rule.action}`,
      `evaluator: ${rule.kind === 'evaluator' ? 'yes' : 'no'}`,
      `source: ${rule.source}`,
      rule.enabled ? 'on' : 'off',
      `hits: ${hits(rule.id)}`,
    ].join('  '),
  )
  return [`cc-enforcer rules (from ${folders}):`, ...rows.map((row) => `  ${row}`), '', MODS_OFF_GUIDANCE].join('\n')
}

export function parseToggle(args: string): ToggleRequest | undefined {
  const [name, state, source, ...rest] = args.trim().split(/\s+/)
  if (!name || !(state in SWITCH_WORDS) || rest.length > 0) return undefined
  if (source !== undefined && !(SOURCES as readonly string[]).includes(source)) return undefined
  return { name, enabled: SWITCH_WORDS[state], ...(source === undefined ? {} : { source: source as RuleSource }) }
}

export function toggleText(request: ToggleRequest | undefined, outcome?: ToggleOutcome): string {
  if (request === undefined || outcome === undefined) return `Usage: /${TOGGLE_COMMAND} ${TOGGLE_USAGE}`
  const state = request.enabled ? 'on' : 'off'
  switch (outcome.kind) {
    case 'switched':
      return `Switched ${outcome.id} ${state} (${outcome.path}).`
    case 'unchanged':
      return `${outcome.id} is already ${state}; nothing was changed.`
    case 'changed':
      return `${outcome.path} changed while it was being switched; nothing was changed. Run the command again.`
    case 'none':
      return `No rule named "${outcome.name}"${request.source === undefined ? '' : ` in the ${request.source} folder`}; nothing was changed.`
    case 'ambiguous':
      return `"${outcome.name}" exists in both the project and the personal folder; nothing was changed. Name the source: /${TOGGLE_COMMAND} ${outcome.name} ${state} project|personal`
  }
}
