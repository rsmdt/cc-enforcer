---
id: 9vn7jd
name: Deleting .claude drops its rules
type: scenario
status: pending
parentId: iu888i
dependsOn: []
---
# Deleting .claude drops its rules

> Priority: P2 · Surface: technical · Verifies: AC-3.1 deleted folder

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Remove the project `.claude/` folder mid-session and run the previously blocked command.

## Expected

- The command runs.
