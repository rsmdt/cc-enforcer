export type TranslateOutcome = { ok: true; regex: RegExp } | { ok: false; problem: string }

const LEADING_FLAGS = /^\(\?([A-Za-z]+)\)/
const PYTHON_ONLY_GROUP_STARTS = ['>', 'P>', '(', '#']

export function translatePattern(pattern: string): TranslateOutcome {
  let flags = 'i'
  let rest = pattern
  for (let match = LEADING_FLAGS.exec(rest); match; match = LEADING_FLAGS.exec(rest)) {
    for (const flag of match[1]) {
      if (flag === 'i') continue
      if (flag !== 's' && flag !== 'm') {
        return { ok: false, problem: `the inline flag "${flag}" has no JavaScript equivalent` }
      }
      if (!flags.includes(flag)) flags += flag
    }
    rest = rest.slice(match[0].length)
  }

  let source = ''
  let isInClass = false
  let index = 0
  while (index < rest.length) {
    const char = rest[index]
    if (char === '\\') {
      const escaped = rest[index + 1] ?? ''
      if (!isInClass && escaped === 'A') source += '(?<![\\s\\S])'
      else if (!isInClass && escaped === 'Z') source += '(?![\\s\\S])'
      else source += char + escaped
      index += 2
      continue
    }
    if (isInClass) {
      if (char === ']') isInClass = false
      source += char
      index += 1
      continue
    }
    if (char === '[') {
      isInClass = true
      source += char
      index += 1
      if (rest[index] === '^') source += rest[index++]
      if (rest[index] === ']') source += rest[index++]
      continue
    }
    if (char === '(' && rest[index + 1] === '?') {
      const tail = rest.slice(index + 2)
      if (tail.startsWith('P<')) {
        source += '(?<'
        index += 4
        continue
      }
      const backreference = /^P=(\w+)\)/.exec(tail)
      if (backreference) {
        source += `\\k<${backreference[1]}>`
        index += 2 + backreference[0].length
        continue
      }
      const pythonOnly = PYTHON_ONLY_GROUP_STARTS.find((start) => tail.startsWith(start))
      if (pythonOnly !== undefined) {
        return { ok: false, problem: `"(?${pythonOnly}" is Python-only regular expression syntax with no JavaScript equivalent` }
      }
      if (/^[A-Za-z]/.test(tail)) {
        return { ok: false, problem: 'an inline flag group after the start of the pattern is Python-only regular expression syntax' }
      }
      source += '(?'
      index += 2
      continue
    }
    if (char === '{') {
      const upToOnly = /^\{,(\d+)\}/.exec(rest.slice(index))
      if (upToOnly) {
        source += `{0,${upToOnly[1]}}`
        index += upToOnly[0].length
        continue
      }
    }
    source += char
    index += 1
  }

  try {
    return { ok: true, regex: new RegExp(source, flags) }
  } catch (error) {
    return { ok: false, problem: 'invalid regular expression: ' + (error instanceof Error ? error.message : String(error)) }
  }
}
