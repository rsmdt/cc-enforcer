---
id: nf1ay3
name: Review failure is reported
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# Review failure is reported

> Priority: P1 · Surface: technical · Verifies: AC-9.2 review failed

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Use the test switch that makes the review reply unparseable.

## Expected

- The user is told the review failed.
- Nothing is sent to Claude.
