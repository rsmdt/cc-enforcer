---
id: cu1my5
name: A crashing check stops the call
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# A crashing check stops the call

> Priority: P1 · Surface: technical · Verifies: AC-9.1 backstop

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Build the plugin with the test fault switch that makes the before-call check throw. Ask Claude to run `git push --force` with the rule active.

## Expected

- The call is denied with a cc-enforcer check-failed message.
- No push is attempted.
