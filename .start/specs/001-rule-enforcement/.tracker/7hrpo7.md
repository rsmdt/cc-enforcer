---
id: 7hrpo7
name: Match beyond 32 KB is not found
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Match beyond 32 KB is not found

> Priority: P2 · Surface: technical · Verifies: Field limits

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: file`, `block`, `pattern: FORBIDDEN`. Ask Claude to Write a file whose first 40 KB are filler and then `FORBIDDEN`.

## Expected

- The Write is not denied (documented field limit).
