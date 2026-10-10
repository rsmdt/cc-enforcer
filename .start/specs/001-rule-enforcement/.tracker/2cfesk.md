---
id: 2cfesk
name: Prompt rules
type: slice
status: passed
parentId: m5921b
dependsOn: [hr99kv]
---
# Slice 8: Prompt rules

A `prompt` rule drops a submitted prompt or adds context to it, including plain-language conditions; a failed check on a block rule drops the prompt.

## Features

- AC-21.3 a matching block prompt is not sent and the user sees the message
- AC-21.4 a matching warn prompt is sent with the message for Claude
- AC-7.4 evaluator conditions on `user_prompt` are judged before the prompt is sent
- AC-9.4 a failed check on a prompt block rule drops the prompt and tells the user

## Behavior — EARS

- WHEN a prompt is checked against a `prompt` rule, THE SYSTEM SHALL use the submitted text as `user_prompt` — AC-1.4
- WHEN a rule blocks a prompt, THE SYSTEM SHALL stop the prompt from being sent — AC-21.3
- WHEN the user submits a prompt that an active `block` rule on `prompt` matches, THE SYSTEM SHALL not send it to Claude and show the user the rule's message — AC-21.3
- WHEN the user submits a prompt that an active `warn` rule on `prompt` matches, THE SYSTEM SHALL send it and give Claude the rule's message with it — AC-21.4
- WHEN every matcher condition of an active `prompt` rule with an evaluator on `user_prompt` holds, THE SYSTEM SHALL obtain the evaluation before the prompt is sent and apply the rule's action only if the evaluator condition holds — AC-7.4
- IF the check of a `block` rule on `prompt` fails, THEN THE SYSTEM SHALL not send the prompt and tell the user which rule's check failed — AC-9.4

## Quality Gates

- NFR-2: prompt evaluations add ≤ 5 s p95
- A defect in the prompt path never drops prompts when no block rule is in flight

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
