---
id: fbg07c
name: Model-judged block stops a violating edit
type: scenario
status: pending
parentId: hr99kv
dependsOn: []
---
# Model-judged block stops a violating edit

> Priority: P0 · Surface: business · Verifies: AC-7.1

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Existing `db/migrations/0007_add_index.sql`. Rule `event: file`, `action: block`, conditions: `file_path regex_match db/migrations/.*\.sql$` and `new_text llm_evaluate "Does this change an existing migration rather than add a new one?"`. Ask Claude to change the index name inside the existing file.

## Expected

- The Edit is denied with the rule's name and body.
- The file is unchanged.
