---
id: 3lgvto
name: Counter resets on a new prompt
type: scenario
status: pending
parentId: 8o224m
dependsOn: []
---
# Counter resets on a new prompt

> Priority: P2 · Surface: technical · Verifies: counter reset

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

After the loop guard ends a turn, submit a new prompt that triggers the same rule once.

## Expected

- The rule blocks again (counter restarted).
