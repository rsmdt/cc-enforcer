---
id: ln6bth
name: New prompt reports unreviewed calls
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# New prompt reports unreviewed calls

> Priority: P2 · Surface: technical · Verifies: prompt reset

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Trigger a queued call, then submit a new prompt before the turn completes (interrupt).

## Expected

- The user is told the queued calls were not reviewed.
