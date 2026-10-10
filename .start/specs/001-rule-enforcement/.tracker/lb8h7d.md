---
id: lb8h7d
name: Hookify's shipped example rule works unchanged
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Hookify's shipped example rule works unchanged

> Priority: P0 · Surface: business · Verifies: AC-1.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Copy Hookify's `dangerous-rm.local.md` example into `.claude/` as `hookify.dangerous-rm.local.md`. Ask Claude to run `rm -rf build`.

## Expected

- The call is denied and the denial carries the example's body text.
- The `build` folder still exists.
