---
id: kix2a6
name: Headless run blocks
type: scenario
status: pending
parentId: mi26iw
dependsOn: []
---
# Headless run blocks

> Priority: P0 · Surface: business · Verifies: AC-6.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Run `claude -p` asking for `npm publish --dry-run` with the rule active.

## Expected

- The call is denied with the rule's message; no question is shown.
