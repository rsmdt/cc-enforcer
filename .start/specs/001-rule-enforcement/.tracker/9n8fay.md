---
id: 9n8fay
name: Finding is attributed, not posed as user text
type: scenario
status: pending
parentId: 3rn0vb
dependsOn: []
---
# Finding is attributed, not posed as user text

> Priority: P1 · Surface: technical · Verifies: AC-8.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same run; inspect the stream for where the finding appears.

## Expected

- The finding appears in the tool result context, labelled with cc-enforcer and the rule name.
- No user message containing the finding is added.
