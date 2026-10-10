---
id: 5ccrxk
name: Over 50 calls
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# Over 50 calls

> Priority: P2 · Surface: technical · Verifies: cap

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Ask Claude to make 55 small qualifying edits in one turn.

## Expected

- 50 are reviewed; the user is told 5 were not reviewed.
