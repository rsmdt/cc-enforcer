---
id: xzkff2
name: Outside git only the working directory's .claude is read
type: scenario
status: pending
parentId: ygxah1
dependsOn: []
---
# Outside git only the working directory's .claude is read

> Priority: P2 · Surface: technical · Verifies: AC-2.3 no git

## Scenario

Setup: a fresh git repository with the cc-enforcer plugin loaded through `claude --plugin-dir <cc-enforcer>`; rule files are written as `.claude/hookify.<name>.local.md` (project) or in a temporary `HOME`'s `.claude/` (personal). Headless runs use `claude -p --output-format stream-json`, so tool results and denial reasons are visible.

A non-git folder tree `top/.claude/hookify.no-force-push.local.md` and an empty `top/sub/`. Start the session in `top/sub/` and ask for `git push --force`.

## Expected

- The call is not denied by `no-force-push`.
