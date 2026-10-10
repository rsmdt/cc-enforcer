---
id: mi26iw
name: Ask rules
type: slice
status: passed
parentId: m5921b
dependsOn: [ygxah1]
---
# Slice 3: Ask rules

An `ask` rule pauses a matching tool call for the user's approval; headless runs block it.

## Features

- AC-6.1 the user is asked with the rule's name and message
- AC-6.2 declining stops the call and Claude gets the message
- AC-6.3 non-interactive runs stop the call
- AC-6.4 `ask` on stop/prompt is reported invalid

## Behavior — EARS

- WHILE the session is interactive, WHEN a tool call matches an active `ask` rule, THE SYSTEM SHALL ask the user to allow it, showing the rule's name and message — AC-6.1
- WHEN the user declines or dismisses the question, THE SYSTEM SHALL stop the call and return the rule's message to Claude — AC-6.2
- WHILE the session is non-interactive, WHEN a tool call matches an active `ask` rule, THE SYSTEM SHALL stop the call and return the rule's message to Claude — AC-6.3
- IF a rule declares action `ask` on the `stop` or `prompt` event, THEN THE SYSTEM SHALL report it as invalid — AC-6.4
- WHEN an `all` rule with action `ask` would apply at a stop or a prompt, THE SYSTEM SHALL not apply it there — FR-6 assumption

## Quality Gates

- NFR-9: ask messages name the rule and carry its body
- Waiting on the user never trips the 10 s hook limit

## Assumptions and open questions

- [ASSUMPTION] Non-interactive runs treat `ask` as `block` (Standing).

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
