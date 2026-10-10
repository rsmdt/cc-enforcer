---
id: l03kbs
name: File Hookify would misread is invalid, not guessed
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# File Hookify would misread is invalid, not guessed

> Priority: P1 · Surface: technical · Verifies: AC-1.2 misread

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Add a rule whose `pattern:` value contains `---` mid-line, and another with a condition missing `pattern`. Start a session.

## Expected

- Both files are reported invalid with their file names.
- Neither rule ever denies a call.
