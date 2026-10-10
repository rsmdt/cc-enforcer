---
id: gx9uze
name: Switching a rule off
type: scenario
status: pending
parentId: 8uk9au
dependsOn: []
---
# Switching a rule off

> Priority: P0 · Surface: business · Verifies: AC-10.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Run `/cc-enforcer-toggle no-force-push off`, then ask Claude to run `git push --force`; start a new session and try again.

## Expected

- The rule file now has `enabled: false`.
- The command is not denied in this or the new session.
