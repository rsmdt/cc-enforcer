---
id: kb0rhi
name: Changed action applies
type: scenario
status: pending
parentId: iu888i
dependsOn: []
---
# Changed action applies

> Priority: P1 · Surface: business · Verifies: AC-3.1 change

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Change the rule's `action` from `block` to `warn`, wait 2 s, run the command again.

## Expected

- The call runs, and Claude's tool result carries the rule's warning.
