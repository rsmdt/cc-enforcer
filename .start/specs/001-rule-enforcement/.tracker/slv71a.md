---
id: slv71a
name: Subagent call is blocked the same way
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Subagent call is blocked the same way

> Priority: P0 · Surface: business · Verifies: AC-5.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

With a `block` rule on `event: file` whose `conditions` hold `file_path` `regex_match` `generated/`, ask Claude to delegate to a subagent (Agent tool) the task of writing `generated/x.ts`.

## Expected

- The subagent's Write call is denied with the rule's name and body.
- `generated/x.ts` does not exist after the run.
