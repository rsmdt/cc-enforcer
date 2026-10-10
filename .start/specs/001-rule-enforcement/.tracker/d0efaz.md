---
id: d0efaz
name: No correction
type: scenario
status: pending
parentId: hhctka
dependsOn: []
---
# No correction

> Priority: P1 · Surface: business · Verifies: AC-12.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Fresh session; run `/cc-enforcer:draft`.

## Expected

- The skill says it found no correction and asks what the rule should be.
