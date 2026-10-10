---
id: s4ku5v
name: ask on stop is invalid
type: scenario
status: pending
parentId: mi26iw
dependsOn: []
---
# ask on stop is invalid

> Priority: P1 · Surface: business · Verifies: AC-6.4

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Add a rule with `event: stop`, `action: ask`. Start a session.

## Expected

- The user is told the file is invalid because `ask` is not allowed on `stop`.
