---
id: zf0hhg
name: llm_evaluate on stop is invalid
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# llm_evaluate on stop is invalid

> Priority: P1 · Surface: business · Verifies: AC-7.5

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Add a `stop` rule with an `llm_evaluate` condition; start a session.

## Expected

- The user is told the file is invalid.
