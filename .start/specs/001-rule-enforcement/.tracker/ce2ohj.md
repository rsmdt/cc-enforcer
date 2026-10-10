---
id: ce2ohj
name: Outside a git repository, a rule in a parent folder's .claude still denies calls made from a subfolder
type: bug
status: pending
parentId: ygxah1
dependsOn: []
---
- 2026-10-12T11:03:12.476Z — xzkff2: non-git tree top/.claude/hookify.no-force-push.local.md + empty top/sub, session started in top/sub with GIT_CEILING_DIRECTORIES=.eval (git rev-parse fails there). git push --force was denied with [cc-enforcer:project:no-force-push] in 3/3 runs. A probe rule placed one level above top/ did not fire, so the walk reached top/ only.
- 2026-10-12T11:46:35.841Z — Re-eval 2026-10-12: xzkff2 no longer reproduces. With GIT_CEILING_DIRECTORIES=.eval, session in top/sub ran git push --force and was NOT denied (git itself failed: not a git repository) in 2/2 completed runs.
