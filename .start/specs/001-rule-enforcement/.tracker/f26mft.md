---
id: f26mft
name: all+ask does not fire on a prompt
type: scenario
status: pending
parentId: mi26iw
dependsOn: []
---
# all+ask does not fire on a prompt

> Priority: P2 · Surface: technical · Verifies: FR-6 assumption

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Rule `event: all`, `action: ask`, `pattern: deploy`. Submit the prompt "deploy notes" interactively.

## Expected

- No question is asked for the prompt and it is sent to Claude.
