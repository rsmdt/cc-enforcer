---
id: fbigfp
name: Evaluation timeout stops the call
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# Evaluation timeout stops the call

> Priority: P1 · Surface: technical · Verifies: AC-9.1 timeout

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Use the test switch that delays evaluations past 5 s.

## Expected

- The call is denied with a check-failed message naming the rule.
