---
id: s6vfjx
name: Headless: log only
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# Headless: log only

> Priority: P1 · Surface: technical · Verifies: no surface

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Run the same task with `claude -p`.

## Expected

- The finding is written to the session log.
- Claude's output contains no finding text.
