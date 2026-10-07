import { compileRule, parseRuleFile, RULE_FILE_PATTERN, setEnabled, type Rule, type RuleSource } from '../rules/index.ts'

export type SourceIo = {
  cwd(): Promise<string>
  home(): Promise<string>
  list(dir: string): Promise<ReadonlyArray<{ name: string; kind: string }>>
  stat(path: string): Promise<{ mtimeMs: number; size: number }>
  read(path: string): Promise<string>
  exists(path: string): Promise<boolean>
  git(args: string[], cwd: string): Promise<{ exitCode: number; stdout: string }>
  write(path: string, text: string): Promise<void>
}

export type Rejection = { path: string; source: RuleSource; problem: string; lastValidKept: boolean }
export type ReportRejection = (rejection: Rejection) => void

export type ListedRule = Rule & { path: string }
export type Overview = { rules: ListedRule[]; projectFolder: string; personalFolder: string }
export type ToggleOutcome =
  | { kind: 'switched'; id: string; path: string; enabled: boolean }
  | { kind: 'unchanged'; id: string; enabled: boolean }
  | { kind: 'changed'; id: string; path: string }
  | { kind: 'none'; name: string }
  | { kind: 'ambiguous'; name: string }

type LoadedFile = { fingerprint: string; rule?: Rule; problem?: string }
type Snapshot = Overview & { active: Rule[] }

export function createRuleSources() {
  const candidateChains = new Map<string, Promise<string[]>>()
  const loadedFiles = new Map<string, LoadedFile>()
  const reportedRejections = new Set<string>()
  let inFlight: Promise<Snapshot> | undefined

  async function candidateFolders(io: SourceIo, cwd: string, personalFolder: string): Promise<string[]> {
    let chain = candidateChains.get(cwd)
    if (chain === undefined) {
      chain = projectCandidates(io, cwd)
      candidateChains.set(cwd, chain)
    }
    return (await chain).map((dir) => joinPath(dir, '.claude')).filter((folder) => folder !== personalFolder)
  }

  function reportOnce(report: ReportRejection, fingerprint: string, rejection: Rejection): void {
    const key = `${rejection.path}\u0000${fingerprint}\u0000${rejection.problem}`
    if (reportedRejections.has(key)) return
    reportedRejections.add(key)
    report(rejection)
  }

  async function loadFolder(io: SourceIo, folder: string, source: RuleSource, names: string[], listed: Set<string>, report: ReportRejection): Promise<ListedRule[]> {
    const rules: ListedRule[] = []
    const claimed = new Map<string, string>()
    const paths = names.map((name) => joinPath(folder, name))
    for (const path of paths) listed.add(path)
    const results = await Promise.all(names.map((name, index) => loadFile(io, paths[index], name, source)))
    for (const [index, name] of names.entries()) {
      const path = paths[index]
      const loaded = results[index]
      if (loaded === undefined) continue
      const rule = loaded.rule
      if (loaded.problem !== undefined) {
        reportOnce(report, loaded.fingerprint, { path, source, problem: loaded.problem, lastValidKept: rule !== undefined })
      }
      if (rule === undefined) continue
      const owner = claimed.get(rule.name)
      if (owner !== undefined) {
        const problem = `the name "${rule.name}" is already used by ${owner} in the same folder`
        reportOnce(report, loaded.fingerprint, { path, source, problem, lastValidKept: false })
        continue
      }
      claimed.set(rule.name, name)
      rules.push({ ...rule, path })
    }
    return rules
  }

  async function loadFile(io: SourceIo, path: string, name: string, source: RuleSource): Promise<LoadedFile | undefined> {
    const fingerprint = await fingerprintOf(io, path, name)
    if (fingerprint === undefined) return undefined
    const cached = loadedFiles.get(path)
    if (cached?.fingerprint === fingerprint) return cached
    const text = await io.read(path).catch(() => undefined)
    if (text === undefined) return undefined
    const outcome = parseRuleFile(name, text)
    const loaded: LoadedFile = outcome.ok
      ? { fingerprint, rule: compileRule(outcome.rule, source) }
      : { fingerprint, problem: outcome.problem, rule: cached?.rule }
    loadedFiles.set(path, loaded)
    return loaded
  }

  async function compile(io: SourceIo, report: ReportRejection): Promise<Snapshot> {
    const [cwd, home] = await Promise.all([io.cwd(), io.home()])
    const personalFolder = joinPath(home, '.claude')
    const listed = new Set<string>()
    const candidates = await candidateFolders(io, cwd, personalFolder)
    let projectFolder = candidates[0] ?? joinPath(cwd, '.claude')
    let projectRules: ListedRule[] = []
    for (const folder of candidates) {
      const names = await ruleFileNames(io, folder)
      if (names.length === 0) continue
      projectFolder = folder
      projectRules = await loadFolder(io, folder, 'project', names, listed, report)
      break
    }
    const personalRules = await loadFolder(io, personalFolder, 'personal', await ruleFileNames(io, personalFolder), listed, report)
    for (const path of loadedFiles.keys()) {
      if (!listed.has(path)) loadedFiles.delete(path)
    }
    const rules = [...projectRules, ...personalRules]
    return { rules, active: rules.filter((rule) => rule.enabled), projectFolder, personalFolder }
  }

  function snapshot(io: SourceIo, report: ReportRejection): Promise<Snapshot> {
    if (inFlight === undefined) {
      inFlight = compile(io, report).finally(() => {
        inFlight = undefined
      })
    }
    return inFlight
  }

  return {
    async current(io: SourceIo, report: ReportRejection): Promise<Rule[]> {
      return (await snapshot(io, report)).active
    },
    async overview(io: SourceIo, report: ReportRejection): Promise<Overview> {
      const { rules, projectFolder, personalFolder } = await snapshot(io, report)
      return { rules, projectFolder, personalFolder }
    },
    async toggle(io: SourceIo, report: ReportRejection, name: string, enabled: boolean, source?: RuleSource): Promise<ToggleOutcome> {
      const { rules } = await snapshot(io, report)
      const matches = rules.filter((rule) => rule.name === name && (source === undefined || rule.source === source))
      if (matches.length === 0) return { kind: 'none', name }
      if (matches.length > 1) return { kind: 'ambiguous', name }
      const [rule] = matches
      if (rule.enabled === enabled) return { kind: 'unchanged', id: rule.id, enabled }
      const fileName = rule.path.slice(rule.path.lastIndexOf('/') + 1)
      const readFingerprint = loadedFiles.get(rule.path)?.fingerprint
      const changed: ToggleOutcome = { kind: 'changed', id: rule.id, path: rule.path }
      if ((await fingerprintOf(io, rule.path, fileName)) !== readFingerprint) return changed
      const text = await io.read(rule.path)
      if ((await fingerprintOf(io, rule.path, fileName)) !== readFingerprint) return changed
      await io.write(rule.path, setEnabled(text, enabled))
      loadedFiles.delete(rule.path)
      return { kind: 'switched', id: rule.id, path: rule.path, enabled }
    },
  }
}

export function hookifyEnabled(enabledPlugins: unknown): boolean {
  if (typeof enabledPlugins !== 'object' || enabledPlugins === null) return false
  return Object.entries(enabledPlugins).some(([plugin, enabled]) => enabled === true && plugin.split('@')[0] === 'hookify')
}

async function fingerprintOf(io: SourceIo, path: string, name: string): Promise<string | undefined> {
  const stat = await io.stat(path).catch(() => undefined)
  return stat === undefined ? undefined : `${name}:${stat.mtimeMs}:${stat.size}`
}

async function projectCandidates(io: SourceIo, cwd: string): Promise<string[]> {
  const discovery = await io.git(['rev-parse', '--show-cdup'], cwd).catch(() => undefined)
  if (discovery === undefined) return nearestGitChain(io, cwd)
  if (discovery.exitCode !== 0) return [cwd]
  const levelsToRoot = discovery.stdout.trim().split('/').filter((segment) => segment === '..').length
  const chain: string[] = [cwd]
  for (let dir = parentOf(cwd); dir !== undefined && chain.length <= levelsToRoot; dir = parentOf(dir)) chain.push(dir)
  return chain
}

async function nearestGitChain(io: SourceIo, cwd: string): Promise<string[]> {
  const chain: string[] = []
  for (let dir: string | undefined = cwd; dir !== undefined; dir = parentOf(dir)) {
    chain.push(dir)
    if (await io.exists(joinPath(dir, '.git')).catch(() => false)) return chain
  }
  return [cwd]
}

async function ruleFileNames(io: SourceIo, folder: string): Promise<string[]> {
  const entries = await io.list(folder).catch(() => [])
  return entries
    .filter((entry) => entry.kind !== 'dir' && RULE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

function parentOf(path: string): string | undefined {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (trimmed === '/' || trimmed === '') return undefined
  const cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}
