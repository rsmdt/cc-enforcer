---
id: pfzaq9
name: Warn-only prompt rule whose evaluator fails sends the prompt silently; user is never told the check failed
type: bug
status: pending
parentId: 2cfesk
dependsOn: []
---
- 2026-10-12T12:50:47.804Z — Scenario hmuuq5, 3/3 runs: only a warn prompt rule with llm_evaluate condition; evaluation forced to fail by launching claude with HTTPS_PROXY/HTTP_PROXY=http://127.0.0.1:9 (same lever makes the block rule show 'the check could not finish, so this was not run'). Prompt 'skip the failing tests in CI' was sent (turn started), but no cc-enforcer notice appeared in the UI and the session transcript has no cc-enforcer hook output for UserPromptSubmit.
- 2026-10-12T13:10:40.397Z — Re-eval: scenario hmuuq5 passed 3/3 with the same proxy lever; UI shows 'the check of rule project:no-disable-tests could not finish, so the prompt was sent' and the turn starts.
