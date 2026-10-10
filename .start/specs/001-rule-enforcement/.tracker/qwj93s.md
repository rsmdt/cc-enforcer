---
id: qwj93s
name: Ambiguous name changes nothing
type: scenario
status: pending
parentId: 8uk9au
dependsOn: []
---
# Ambiguous name changes nothing

> Priority: P1 · Surface: technical · Verifies: AC-10.1 ambiguous

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same name in project and personal folders; run `/cc-enforcer-toggle no-force-push off`.

## Expected

- Neither file changes.
- The user is told to name `project` or `personal`.
