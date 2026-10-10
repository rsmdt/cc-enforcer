---
id: rtlpjb
name: Model failure stops the call
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# Model failure stops the call

> Priority: P0 · Surface: business · Verifies: AC-9.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Run with model access forced to fail (invalid API key environment for evaluations, or the test fault switch). Ask Claude to edit the existing migration.

## Expected

- The Edit is denied with a check-failed message naming the rule.
- The file is unchanged.
