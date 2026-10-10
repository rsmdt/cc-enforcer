---
id: gk1y3n
name: Log holds no content
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Log holds no content

> Priority: P1 · Surface: technical · Verifies: DR-6

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Trigger one denial with a command containing the token `SECRET123`. Read `~/.cc-enforcer/logs/<session-id>.jsonl` (or the documented location).

## Expected

- The log has an entry with rule name, outcome, event and tool.
- The string `SECRET123` does not appear anywhere in the log.
- The log file is readable by its owner only (where the platform supports it).
