---
id: jz8kzo
name: Non-matching command runs normally
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Non-matching command runs normally

> Priority: P0 · Surface: business · Verifies: AC-5.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

With the same rule active, ask Claude to run `echo hello > out.txt`.

## Expected

- The command runs and `out.txt` contains `hello`.
- The tool result carries no cc-enforcer text.
