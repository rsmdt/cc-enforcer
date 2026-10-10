---
id: 4t9jms
name: all+evaluator skips stop
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# all+evaluator skips stop

> Priority: P2 · Surface: technical · Verifies: FR-7 assumption

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: all`, `action: block`, one `llm_evaluate` condition on `command`. Let Claude finish a turn.

## Expected

- The turn ends normally; no evaluation runs at stop.
