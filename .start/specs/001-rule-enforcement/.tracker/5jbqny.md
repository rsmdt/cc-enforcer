---
id: 5jbqny
name: Invalid rule file is reported, others still apply
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Invalid rule file is reported, others still apply

> Priority: P1 · Surface: business · Verifies: AC-1.2

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

Add `hookify.broken.local.md` whose frontmatter has `event: banana`, next to the valid force-push rule. Start a session and ask Claude to run `git push --force`.

## Expected

- The user sees a notice naming `hookify.broken.local.md` and the unknown event.
- The force-push call is still denied by `no-force-push`.
