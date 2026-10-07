export type ConditionEntry = Record<string, string>
export type FrontmatterValue = string | boolean | Array<ConditionEntry | string>
export type Frontmatter = Record<string, FrontmatterValue>

export type FrontmatterOutcome =
  | { ok: true; frontmatter: Frontmatter; body: string }
  | { ok: false; problem: string }

class FrontmatterProblem extends Error {}

const KEY_VALUE = /^([A-Za-z_][\w-]*):(?:[ ]+(.*))?$/
const YAML_INDICATOR_START = /^([[\]{}&*!|>%@`,#]|[-?:](\s|$))/

export function splitFrontmatter(text: string): FrontmatterOutcome {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[0].trimEnd() !== '---') {
    return { ok: false, problem: 'the file has no frontmatter: its first line must be "---"' }
  }
  const closing = lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---')
  if (closing < 0) {
    return { ok: false, problem: 'the frontmatter is not closed by a line "---"' }
  }
  const frontmatterLines = lines.slice(1, closing)
  if (frontmatterLines.some((line) => line.includes('---'))) {
    return { ok: false, problem: 'a value contains "---", which Hookify reads as the end of the frontmatter' }
  }
  try {
    return { ok: true, frontmatter: parseLines(frontmatterLines), body: lines.slice(closing + 1).join('\n').trim() }
  } catch (error) {
    if (error instanceof FrontmatterProblem) return { ok: false, problem: error.message }
    throw error
  }
}

function parseLines(lines: string[]): Frontmatter {
  const frontmatter: Frontmatter = {}
  let listKey: string | undefined
  let list: Array<ConditionEntry | string> = []
  let entry: ConditionEntry | undefined
  let entryKeyColumn = -1

  const closeList = () => {
    if (listKey !== undefined && list.length === 0) {
      throw new FrontmatterProblem(`the key "${listKey}" has no value`)
    }
    listKey = undefined
    entry = undefined
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 2
    if (line.includes('\t')) {
      throw new FrontmatterProblem(`line ${lineNumber}: a tab character; YAML indents with spaces`)
    }
    const stripped = line.trim()
    if (stripped === '' || stripped.startsWith('#')) return
    const indent = line.length - line.trimStart().length

    if (indent === 0 && !stripped.startsWith('-')) {
      closeList()
      const match = KEY_VALUE.exec(line.trimEnd())
      if (!match) throw new FrontmatterProblem(`line ${lineNumber}: expected "key: value"`)
      const [, key, raw = ''] = match
      if (key in frontmatter) throw new FrontmatterProblem(`line ${lineNumber}: the key "${key}" appears twice`)
      if (raw.trim() === '') {
        listKey = key
        list = []
        frontmatter[key] = list
        return
      }
      frontmatter[key] = readScalar(raw, lineNumber, true)
      return
    }

    if (stripped === '-' || stripped.startsWith('- ')) {
      if (listKey === undefined) throw new FrontmatterProblem(`line ${lineNumber}: a list item outside a list`)
      const itemText = stripped.slice(1).trim()
      if (itemText.includes(':') && itemText.includes(',')) {
        throw new FrontmatterProblem(
          `line ${lineNumber}: Hookify splits this list item at each comma; put each condition field on its own line and keep commas out of the first one`,
        )
      }
      const match = KEY_VALUE.exec(itemText)
      if (!match) {
        list.push(readScalar(itemText, lineNumber, false) as string)
        entry = undefined
        return
      }
      const [, key, raw = ''] = match
      if (raw.trim() === '') throw new FrontmatterProblem(`line ${lineNumber}: nested values are not supported`)
      entry = { [key]: readScalar(raw, lineNumber, false) as string }
      entryKeyColumn = indent + (stripped.length - itemText.length)
      list.push(entry)
      return
    }

    if (entry === undefined) {
      throw new FrontmatterProblem(`line ${lineNumber}: unsupported YAML; only "key: value" lines and a list of conditions are read`)
    }
    if (indent <= 2) {
      throw new FrontmatterProblem(
        `line ${lineNumber}: Hookify ignores a condition field indented by two spaces or fewer; indent condition fields by more than two spaces`,
      )
    }
    if (indent !== entryKeyColumn) {
      throw new FrontmatterProblem(`line ${lineNumber}: condition fields must line up at the same indent as the first field`)
    }
    const match = KEY_VALUE.exec(stripped)
    if (!match) throw new FrontmatterProblem(`line ${lineNumber}: expected "key: value"`)
    const [, key, raw = ''] = match
    if (key in entry) throw new FrontmatterProblem(`line ${lineNumber}: the key "${key}" appears twice in one condition`)
    if (raw.trim() === '') throw new FrontmatterProblem(`line ${lineNumber}: the key "${key}" has no value`)
    entry[key] = readScalar(raw, lineNumber, false) as string
  })
  closeList()
  return frontmatter
}

function readScalar(raw: string, lineNumber: number, isTopLevel: boolean): string | boolean {
  const value = raw.trim()
  if (value.startsWith('"')) {
    const inner = closedQuote(value, '"', lineNumber)
    if (inner.includes('\\')) {
      throw new FrontmatterProblem(
        `line ${lineNumber}: a double-quoted value with a backslash, which YAML unescapes and Hookify keeps; use single quotes or no quotes`,
      )
    }
    return inner
  }
  if (value.startsWith("'")) {
    return closedQuote(value, "'", lineNumber)
  }
  if (YAML_INDICATOR_START.test(value)) {
    throw new FrontmatterProblem(`line ${lineNumber}: YAML does not read "${value}" as text; put it in single quotes`)
  }
  if (/\s#/.test(value)) {
    throw new FrontmatterProblem(`line ${lineNumber}: " #" starts a YAML comment, which Hookify keeps as part of the value; quote the value`)
  }
  if (/:(\s|$)/.test(value)) {
    throw new FrontmatterProblem(`line ${lineNumber}: ": " inside an unquoted value is not valid YAML; quote the value`)
  }
  if (/["']$/.test(value)) {
    throw new FrontmatterProblem(`line ${lineNumber}: Hookify strips a trailing quote from an unquoted value; quote the whole value`)
  }
  if (isTopLevel && /^(true|false)$/i.test(value)) return value.toLowerCase() === 'true'
  return value
}

function closedQuote(value: string, quote: string, lineNumber: number): string {
  if (value.length < 2 || !value.endsWith(quote)) {
    throw new FrontmatterProblem(`line ${lineNumber}: an unclosed quote, or text after the closing quote`)
  }
  const inner = value.slice(1, -1)
  if (inner.includes(quote)) {
    throw new FrontmatterProblem(`line ${lineNumber}: a quote inside a quoted value, which Hookify reads differently from YAML`)
  }
  return inner
}
