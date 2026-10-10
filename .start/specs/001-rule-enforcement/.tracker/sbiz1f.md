---
id: sbiz1f
name: Loop guard ends the turn
type: scenario
status: pending
parentId: 8o224m
dependsOn: []
---
# Loop guard ends the turn

> Priority: P0 · Surface: business · Verifies: AC-21.5

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: stop`, `action: block`, `pattern: .*`. Ask Claude a trivial question.

## Expected

- After three blocks the turn ends.
- The user is told the rule name that kept blocking.
