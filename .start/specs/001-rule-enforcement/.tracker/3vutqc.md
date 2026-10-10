---
id: 3vutqc
name: Evaluator judges the prompt
type: scenario
status: pending
parentId: 2cfesk
dependsOn: []
---
# Evaluator judges the prompt

> Priority: P1 · Surface: business · Verifies: AC-7.4

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: prompt`, `action: block`, condition `user_prompt llm_evaluate "Does this ask to disable tests?"`. Submit "skip the failing tests in CI" and then "explain the CI config".

## Expected

- The first prompt is dropped with the rule's message.
- The second prompt is sent.
