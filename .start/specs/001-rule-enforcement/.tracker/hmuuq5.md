---
id: hmuuq5
name: Warn-only failure sends the prompt
type: scenario
status: pending
parentId: 2cfesk
dependsOn: []
---
# Warn-only failure sends the prompt

> Priority: P2 · Surface: technical · Verifies: warn-only failure

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Only a `warn` prompt rule with an evaluator; evaluations forced to fail.

## Expected

- The prompt is sent and the user is told the check failed.
