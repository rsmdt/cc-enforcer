---
id: kb5azc
name: Rules apply from a subdirectory
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Rules apply from a subdirectory

> Priority: P1 · Surface: business · Verifies: AC-2.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rules in `<repo>/.claude/`; start the session in `<repo>/packages/app/`. Ask Claude to run `git push --force`.

## Expected

- The call is denied by the project rule.
