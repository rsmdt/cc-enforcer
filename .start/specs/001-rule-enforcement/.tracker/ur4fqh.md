---
id: ur4fqh
name: Failed prompt check drops the prompt
type: scenario
status: pending
parentId: 2cfesk
dependsOn: []
---
# Failed prompt check drops the prompt

> Priority: P1 · Surface: business · Verifies: AC-9.4

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Evaluations forced to fail; submit a prompt that matches the evaluator rule's matchers.

## Expected

- The prompt is not sent.
- The user is told the check failed and which rule.
