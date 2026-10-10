---
id: f97ych
name: Strictest matching copy wins; non-matching copy lends nothing
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Strictest matching copy wins; non-matching copy lends nothing

> Priority: P1 · Surface: business · Verifies: AC-2.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Project `no-force-push` with `action: warn` and `pattern: push --force`; personal `no-force-push` with `action: block` and `pattern: push --force origin main`. Ask Claude to run `git push --force origin main`, then `git push --force origin dev` (with a stub remote).

## Expected

- The first call is denied, and the message names both copies.
- The second call is not denied (only the project `warn` copy matches).
