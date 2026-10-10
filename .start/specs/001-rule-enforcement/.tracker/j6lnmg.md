---
id: j6lnmg
name: Long session still enforces stop rules
type: scenario
status: pending
parentId: 8o224m
dependsOn: []
---
# Long session still enforces stop rules

> Priority: P2 · Surface: technical · Verifies: large transcript

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Start a session whose transcript exceeds 4 MiB (seeded), with a stop rule matching text in Claude's last message.

## Expected

- The stop rule still matches and blocks.
