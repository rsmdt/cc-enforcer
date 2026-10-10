---
id: cm3cuw
name: Broken edit keeps last good version
type: scenario
status: pending
parentId: iu888i
dependsOn: []
---
# Broken edit keeps last good version

> Priority: P1 · Surface: business · Verifies: AC-3.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Edit the active `block` rule so its frontmatter is invalid YAML; wait 2 s; run the matching command twice.

## Expected

- Both calls are still denied by the previous version.
- The user is told once that the edit to that file was rejected (one notice, not two).
