---
id: z6tt9y
name: User declines
type: scenario
status: pending
parentId: mi26iw
dependsOn: []
---
# User declines

> Priority: P0 · Surface: business · Verifies: AC-6.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Same setup; decline the question.

## Expected

- The command does not run.
- Claude's tool result carries the rule's message.
