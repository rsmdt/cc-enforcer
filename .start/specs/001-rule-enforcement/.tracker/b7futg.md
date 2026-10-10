---
id: b7futg
name: Compliant change passes
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# Compliant change passes

> Priority: P0 · Surface: business · Verifies: AC-7.1 holds not

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same rule; ask Claude to create a new file `db/migrations/0008_add_col.sql`.

## Expected

- The Write runs and the file exists.
