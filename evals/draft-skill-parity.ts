import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseRuleFile } from '../src/rules/index.ts'

const skill = readFileSync(new URL('../skills/draft/SKILL.md', import.meta.url), 'utf8')
const exampleDrafts = [...skill.matchAll(/^```markdown (hookify\.[^\s]+\.local\.md)\n([\s\S]*?)^```$/gm)].map(([, fileName, text]) => ({ fileName, text }))

test('the skill carries example drafts', () => {
  assert.ok(exampleDrafts.length >= 3, `found ${exampleDrafts.length} example drafts`)
})

test('every example draft validates through Rules without warnings', () => {
  for (const { fileName, text } of exampleDrafts) {
    const outcome = parseRuleFile(fileName, text)
    assert.ok(outcome.ok, `${fileName}: ${outcome.ok ? '' : outcome.problem}`)
    assert.deepEqual(outcome.warnings, [], fileName)
  }
})

test('the examples cover ask and a plain-language condition', () => {
  assert.ok(exampleDrafts.some(({ text }) => /^action: ask$/m.test(text)))
  assert.ok(exampleDrafts.some(({ text }) => /operator: llm_evaluate$/m.test(text)))
})

test('the skill warns that Hookify does not understand ask and llm_evaluate', () => {
  assert.match(skill, /Hookify does not understand `ask` or `llm_evaluate`/)
  assert.match(skill, /treats `ask` as `warn`/)
  assert.match(skill, /never fires/)
})
