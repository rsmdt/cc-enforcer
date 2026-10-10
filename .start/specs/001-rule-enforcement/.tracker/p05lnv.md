---
id: p05lnv
name: Project and personal rules both apply
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Project and personal rules both apply

> Priority: P1 · Surface: business · Verifies: AC-2.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Personal rule `no-sudo` (`event: bash`, `block`, `pattern: sudo`) in the temporary HOME's `.claude/`; project rule `no-force-push`. Ask Claude to run `sudo ls`, then `git push --force`.

## Expected

- Both calls are denied, each naming its own rule.
- The session log records the source (`personal` / `project`) for each hit.
