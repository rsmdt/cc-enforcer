---
id: geo1pa
name: Hookify also enabled
type: scenario
status: pending
parentId: 8uk9au
dependsOn: []
---
# Hookify also enabled

> Priority: P1 · Surface: business · Verifies: AC-1.5

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Enable the Hookify plugin in settings and start a session.

## Expected

- The user is told both plugins would enforce the same rule files and Hookify should be disabled.
