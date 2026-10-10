---
id: wkyzut
name: New rule applies without restart
type: scenario
status: pending
parentId: iu888i
dependsOn: []
---
# New rule applies without restart

> Priority: P0 · Surface: business · Verifies: AC-3.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Interactive session with no rules. Run `echo a` (succeeds). Save a new `block` rule for `echo b`, wait 2 s, ask Claude to run `echo b`.

## Expected

- `echo b` is denied by the new rule without restarting the session.
