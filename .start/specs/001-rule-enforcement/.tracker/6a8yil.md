---
id: 6a8yil
name: Draft proposed, nothing written
type: scenario
status: pending
parentId: hhctka
dependsOn: []
---
# Draft proposed, nothing written

> Priority: P0 · Surface: business · Verifies: AC-12.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Interactive session: ask Claude to add `console.log` to a file, then say "don't use console.log, use the logger". Run `/cc-enforcer:draft`.

## Expected

- A complete rule (name, event, action, conditions, message) is shown.
- No new `hookify.*.local.md` file exists yet.
