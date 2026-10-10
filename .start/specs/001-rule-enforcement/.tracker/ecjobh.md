---
id: ecjobh
name: No turn starts by itself
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# No turn starts by itself

> Priority: P1 · Surface: technical · Verifies: no auto-turn

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same setup; after the finding appears, wait 60 s without input.

## Expected

- No new turn starts; the transcript gains no message.
