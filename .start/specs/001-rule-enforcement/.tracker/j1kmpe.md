---
id: j1kmpe
name: Finding shown after the turn
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# Finding shown after the turn

> Priority: P0 · Surface: business · Verifies: AC-8.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Interactive session. Rule `event: file`, `action: warn`, condition `new_text llm_evaluate "Does this add a public function without a doc comment?"`. Ask Claude to add an undocumented exported function to `src/util.ts`.

## Expected

- The edit runs.
- After Claude's turn ends, the user sees a finding labelled with the rule name, in the log and in the band above the prompt with "Send to Claude" and "Dismiss".
