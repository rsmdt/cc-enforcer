---
id: 3yxaml
name: Deleted rule stops applying
type: scenario
status: pending
parentId: iu888i
dependsOn: []
---
# Deleted rule stops applying

> Priority: P1 · Surface: business · Verifies: AC-3.1 delete

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

With a `block` rule for `echo b` active, delete the file, wait 2 s, ask Claude to run `echo b`.

## Expected

- `echo b` runs.
