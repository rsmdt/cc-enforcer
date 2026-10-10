---
id: fnnln1
name: Read is checked only against all rules
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Read is checked only against all rules

> Priority: P1 · Surface: technical · Verifies: AC-1.4 other tools

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rules: `event: bash`, `action: block`, `pattern: .*`; and `event: all`, `action: block`, `conditions: file_path contains secret`. Ask Claude to read `README.md`, then `secret.txt`.

## Expected

- Reading `README.md` succeeds (the bash rule does not apply to Read).
- Reading `secret.txt` is denied by the `all` rule.
