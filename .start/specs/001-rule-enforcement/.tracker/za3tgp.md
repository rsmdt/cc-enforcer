---
id: za3tgp
name: Mods-off guidance
type: scenario
status: pending
parentId: 8uk9au
dependsOn: []
---
# Mods-off guidance

> Priority: P1 · Surface: business · Verifies: AC-9.3

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Open the overview's help; open README.md.

## Expected

- Both mention the transcript notice, the `mods active` line in `/plugin`, and `/reload-plugins`.
