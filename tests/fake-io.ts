import type { SourceIo } from '../src/sources/index.ts'

const READ_LIMIT = 4 * 1024 * 1024

export type FakeGit = 'repo' | 'not-a-repo' | 'unavailable'

export type FakeFsOptions = { cwd: string; home: string; dirs?: string[]; unlistable?: string[]; git?: FakeGit }

export function fakeIo(files: Record<string, string>, options: FakeFsOptions): SourceIo {
  const fs = virtualFs(files, options.dirs ?? [], options.unlistable ?? [])
  return {
    cwd: async () => options.cwd,
    home: async () => options.home,
    list: async (dir) => fs.list(dir),
    stat: async (path) => fs.stat(path),
    read: async (path) => fs.read(path),
    exists: async (path) => fs.exists(path),
    git: async (args, cwd) => fakeGit(fs, options.git ?? 'repo', args, cwd),
    write: async (path, text) => {
      files[path] = text
    },
  }
}

export function fakeGit(fs: ReturnType<typeof virtualFs>, mode: FakeGit, args: string[], cwd: string) {
  if (mode === 'unavailable') throw new Error('process.run is not available')
  if (args.join(' ') !== 'rev-parse --show-cdup') throw new Error('unexpected git ' + args.join(' '))
  let levels = 0
  for (let dir: string | undefined = cwd; dir !== undefined && mode === 'repo'; dir = parentOf(dir), levels++) {
    if (fs.exists(dir === '/' ? '/.git' : dir + '/.git')) return { exitCode: 0, stdout: '../'.repeat(levels) + '\n', stderr: '' }
  }
  return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' }
}

export function virtualFs(files: Record<string, string>, dirs: string[], unlistable: string[] = []) {
  const directories = new Set<string>()
  const addParents = (path: string) => {
    for (let dir = parentOf(path); dir !== undefined; dir = parentOf(dir)) directories.add(dir)
  }
  const addFileParents = () => {
    for (const path of Object.keys(files)) addParents(path)
  }
  addFileParents()
  for (const dir of dirs) {
    directories.add(dir)
    addParents(dir)
  }
  return {
    list(dir: string) {
      if (unlistable.includes(dir)) throw new Error('EACCES: ' + dir)
      addFileParents()
      if (!directories.has(dir)) throw new Error('ENOENT: ' + dir)
      const prefix = dir === '/' ? '/' : dir + '/'
      const names = new Map<string, 'file' | 'dir'>()
      for (const path of Object.keys(files)) {
        if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) names.set(path.slice(prefix.length), 'file')
      }
      for (const path of directories) {
        if (path.startsWith(prefix) && path !== dir && !path.slice(prefix.length).includes('/')) names.set(path.slice(prefix.length), 'dir')
      }
      return [...names].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, kind]) => ({ name, kind, size: kind === 'file' ? files[prefix + name].length : 0, isLink: false }))
    },
    stat(path: string) {
      if (path in files) return { kind: 'file', size: files[path].length, mtimeMs: 1, isLink: false }
      addFileParents()
      if (directories.has(path)) return { kind: 'dir', size: 0, mtimeMs: 1, isLink: false }
      throw new Error('ENOENT: ' + path)
    },
    read(path: string) {
      if (!(path in files)) throw new Error('ENOENT: ' + path)
      if (files[path].length > READ_LIMIT) throw new Error('EFBIG: ' + path)
      return files[path]
    },
    exists(path: string) {
      addFileParents()
      return path in files || directories.has(path)
    },
  }
}

function parentOf(path: string): string | undefined {
  if (path === '/') return undefined
  const cut = path.lastIndexOf('/')
  return cut <= 0 ? '/' : path.slice(0, cut)
}

type StubRegistrar = (name: string, stub: (...args: any[]) => unknown) => void

export type ModSetup = {
  files: Record<string, string>
  cwd: string
  home?: string
  dirs?: string[]
  sessionId?: string
  agents?: Array<{ id: string; type: string; description: string; status: string }>
  failing?: string[]
  failingAfterTool?: string[]
  git?: FakeGit
  settings?: Record<string, unknown>
  classify?: (text: string, labels: readonly string[]) => Promise<string | undefined>
  answerAsk?: (question: string, labels: readonly string[]) => Promise<string>
  surfaces?: string[]
  complete?: (request: ReviewRequest) => Promise<unknown>
  promptDraft?: string
}

export type ReviewRequest = { model: string; system?: string; prompt: string; maxTokens?: number; timeoutMs?: number }

export function stubMods(on: StubRegistrar, setup: ModSetup) {
  const home = setup.home ?? '/home/u'
  const fs = virtualFs(setup.files, setup.dirs ?? [])
  const writes = new Map<string, string>()
  const userLines: string[] = []
  const toolCalls: string[] = []
  const logFileSteps: string[] = []
  const asked: Array<{ question: string; header: string; labels: string[] }> = []
  const commands: string[] = []
  const classified: string[] = []
  const stops: string[] = []
  const prompts: Array<{ text: string; context?: string[] }> = []
  const completions: ReviewRequest[] = []
  const fills: Array<{ text: string; mode?: string }> = []
  const failing = new Set(setup.failing ?? [])
  const answer = (name: string, value: () => unknown) => {
    if (failing.has(name)) return { deny: name + ' failed' }
    try {
      return { value: value() }
    } catch (error) {
      return { deny: (error as Error).message }
    }
  }
  on('session.cwd', () => answer('session.cwd', () => setup.cwd))
  on('session.id', () => answer('session.id', () => setup.sessionId ?? 'session-1'))
  on('env.get', ($: unknown, e: { name: string }) => answer('env.get', () => (e.name === 'HOME' ? home : undefined)))
  on('fs.list', ($: unknown, e: { path: string }) => answer('fs.list', () => fs.list(e.path)))
  on('fs.stat', ($: unknown, e: { path: string }) => answer('fs.stat', () => fs.stat(e.path)))
  on('fs.read', ($: unknown, e: { path: string }) => answer('fs.read', () => fs.read(e.path)))
  on('fs.exists', ($: unknown, e: { path: string }) => answer('fs.exists', () => fs.exists(e.path)))
  on('process.run', ($: unknown, e: { argv: string[]; init?: { cwd?: string } }) =>
    answer('process.run', () => {
      const [command, ...args] = e.argv
      if (command === 'git') return fakeGit(fs, setup.git ?? 'repo', args, e.init?.cwd ?? setup.cwd)
      logFileSteps.push(`run ${e.argv.join(' ')}`)
      return { exitCode: 0, stdout: '', stderr: '' }
    }),
  )
  on('fs.write', ($: unknown, e: { path: string; text: string }) =>
    answer('fs.write', () => {
      logFileSteps.push(`write ${e.path}`)
      writes.set(e.path, e.text)
      setup.files[e.path] = e.text
      return undefined
    }),
  )
  on('model.classify', async ($: unknown, e: { text: string; labels: readonly string[] }) => {
    classified.push(e.text)
    if (setup.classify === undefined) return { deny: 'no model in tests' }
    try {
      return { value: await setup.classify(e.text, e.labels) }
    } catch (error) {
      return { deny: (error as Error).message }
    }
  })
  on('model.complete', async ($: unknown, e: ReviewRequest) => {
    completions.push(e)
    if (setup.complete === undefined) return { deny: 'no model in tests' }
    try {
      return { value: await setup.complete(e) }
    } catch (error) {
      return { deny: (error as Error).message }
    }
  })
  on('session.surfaces', () => answer('session.surfaces', () => setup.surfaces ?? []))
  on('prompt.read', () => answer('prompt.read', () => ({ text: setup.promptDraft ?? '', cursor: (setup.promptDraft ?? '').length })))
  on('prompt.fill', ($: unknown, e: { text: string; mode?: string }) => {
    fills.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  on('turn.complete', ($: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.render', ($: any, e: unknown) => h($.ui.resolve(e).Box, { key: 'engine-band' }))
  on('agent.list', () => answer('agent.list', () => setup.agents ?? []))
  on('settings.read', () => answer('settings.read', () => setup.settings ?? {}))
  on('command.register', ($: unknown, e: { name: string }) =>
    answer('command.register', () => {
      commands.push(e.name)
      return { command: e.name }
    }),
  )
  on('ui.log', ($: unknown, e: { text: string }) => answer('ui.log', () => void userLines.push(e.text)))
  on('ui.toast', ($: unknown, e: { text: string }) => answer('ui.toast', () => void userLines.push(e.text)))
  on('session.start', () => ({ cwd: setup.cwd }))
  on('prompt.submit', ($: unknown, e: { text: string; context?: string[] }) => {
    prompts.push({ text: e.text, context: e.context })
    return { text: e.text }
  })
  on('classic.Stop', () => {
    stops.push('main session')
    return {}
  })
  on('classic.SubagentStop', ($: unknown, e: { agent_id: string }) => {
    stops.push(e.agent_id)
    return {}
  })
  on('tool.call', async ($: unknown, e: { tool: string; questions?: Array<{ question: string; header: string; options: Array<{ label: string }> }> }) => {
    if (e.tool === 'AskUserQuestion') return answerAskUserQuestion(e.questions ?? [])
    toolCalls.push(e.tool)
    for (const name of setup.failingAfterTool ?? []) failing.add(name)
    return { result: 'ran' }
  })
  async function answerAskUserQuestion(questions: Array<{ question: string; header: string; options: Array<{ label: string }> }>) {
    const [{ question, header, options }] = questions
    const labels = options.map((option) => option.label)
    asked.push({ question, header, labels })
    if (setup.answerAsk === undefined) return { deny: 'no one to ask' }
    try {
      return { result: { answers: { [question]: await setup.answerAsk(question, labels) } } }
    } catch (error) {
      return { deny: (error as Error).message }
    }
  }
  return { writes, userLines, toolCalls, logFileSteps, stops, classified, commands, asked, prompts, completions, fills }
}
