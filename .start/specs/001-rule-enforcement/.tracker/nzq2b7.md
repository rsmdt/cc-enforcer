---
id: nzq2b7
name: No model call when the matcher fails
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# No model call when the matcher fails

> Priority: P1 · Surface: technical · Verifies: AC-7.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same rule; ask Claude to edit `src/app.ts`. Observe the log (or model-call count in the session's usage).

## Expected

- The edit runs with no added evaluation (no evaluator entry in the log for that call).
