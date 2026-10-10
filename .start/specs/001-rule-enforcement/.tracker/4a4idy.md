---
id: 4a4idy
name: Approved draft applies at once
type: scenario
status: pending
parentId: hhctka
dependsOn: []
---
# Approved draft applies at once

> Priority: P0 · Surface: business · Verifies: AC-12.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Approve the draft into the project folder; ask Claude to add another `console.log`.

## Expected

- The file exists in `.claude/`.
- The next matching call is warned or blocked per the draft's action.
