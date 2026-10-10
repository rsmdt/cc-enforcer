---
id: sjmdj5
name: Finding is shown and logged
type: scenario
status: pending
parentId: 3rn0vb
dependsOn: []
---
# Finding is shown and logged

> Priority: P2 · Surface: technical · Verifies: log

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Interactive session, trigger the warn rule.

## Expected

- The user sees the finding in the terminal.
- The session log has a `finding` entry for the rule.
