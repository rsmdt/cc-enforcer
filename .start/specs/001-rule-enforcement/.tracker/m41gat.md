---
id: m41gat
name: Send to Claude fills the prompt box
type: scenario
status: pending
parentId: ye84t5
dependsOn: []
---
# Send to Claude fills the prompt box

> Priority: P0 · Surface: business · Verifies: AC-8.2 send

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

With the finding shown and some draft text typed in the prompt box, press 1 (Send to Claude).

## Expected

- The prompt box contains the draft text plus the labelled finding.
- Nothing is sent until the user submits.
