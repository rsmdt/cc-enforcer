---
id: bayl2e
name: A file rule matches on Write content
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# A file rule matches on Write content

> Priority: P1 · Surface: technical · Verifies: AC-1.4 Write

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: file`, `action: block`, `pattern: TODO`. Ask Claude to create a new file `notes.md` containing `TODO: x` with the Write tool.

## Expected

- The Write call is denied and `notes.md` does not exist.
