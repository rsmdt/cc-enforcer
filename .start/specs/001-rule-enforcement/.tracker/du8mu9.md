---
id: du8mu9
name: Unknown name changes nothing
type: scenario
status: pending
parentId: 8uk9au
dependsOn: []
---
# Unknown name changes nothing

> Priority: P2 · Surface: technical · Verifies: AC-10.1 unknown

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Run `/cc-enforcer-toggle does-not-exist off`.

## Expected

- No file changes; the user is told the rule was not found.
