---
id: 6go7xk
name: Blocked prompt is not sent
type: scenario
status: pending
parentId: 2cfesk
dependsOn: []
---
# Blocked prompt is not sent

> Priority: P0 · Surface: business · Verifies: AC-21.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Interactive session, rule `event: prompt`, `action: block`, `pattern: prod-db`, body "Never ask Claude to touch prod-db directly." Submit "drop a table in prod-db".

## Expected

- No turn starts.
- The user sees the rule's message and their text is back in the prompt box.
