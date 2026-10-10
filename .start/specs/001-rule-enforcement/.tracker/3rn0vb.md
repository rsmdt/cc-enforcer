---
id: 3rn0vb
name: Warn findings on tool results
type: slice
status: failed
parentId: m5921b
dependsOn: [ygxah1]
---
# Slice 4: Warn findings on tool results

A matcher-only `warn` rule lets the call run and Claude reads the finding with the result; failures after a call never undo it.

## Features

- AC-8.1 a matcher-only warn finding reaches Claude with the call's result
- AC-8.3 findings are attributed to cc-enforcer and the rule, never the user

## Behavior — EARS

- THE SYSTEM SHALL check each tool call once, before it runs for `block` and `ask` rules and after it runs for `warn` rules — AC-5.1, AC-8.1
- WHEN a completed tool call matches an active `warn` rule with matcher conditions only, THE SYSTEM SHALL attach the finding to that call's result for Claude — AC-8.1
- THE SYSTEM SHALL label every message and finding with cc-enforcer and the rule's name and never deliver it as the user's words — AC-8.3
- WHEN a finding is produced, THE SYSTEM SHALL record it in the local session log and, where the session has a terminal surface, show it to the user — FR-8 assumption, DR-6
- IF the check of a `warn` rule fails, THEN THE SYSTEM SHALL let the call proceed and tell the user the check failed — AC-9.2
- IF the enforcer fails after a tool call has run, THEN THE SYSTEM SHALL return the call's result and tell the user the check failed — AC-9.2

## Quality Gates

- NFR-9: 100% of warn messages name the rule and carry its body
- A failure after a call never turns into a denial

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
