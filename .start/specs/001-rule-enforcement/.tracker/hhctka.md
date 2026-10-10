---
id: hhctka
name: Draft a rule from the conversation
type: slice
status: passed
parentId: m5921b
dependsOn: [ygxah1]
---
# Slice 10: Draft a rule from the conversation

`/cc-enforcer:draft` turns a correction into an approved rule file that applies at once.

## Features

- AC-12.1 a complete rule file is proposed and nothing is written before approval
- AC-12.2 an approved draft is saved to the chosen folder and applies to the next tool call
- AC-12.3 with no correction, the command says so and asks

## Behavior — EARS

- WHEN the user runs the drafting command after a correction, THE SYSTEM SHALL propose a complete rule file and write nothing until the user approves — AC-12.1
- WHEN the user approves a draft, THE SYSTEM SHALL save it to the folder the user chose so it applies to the next tool call — AC-12.2
- IF the conversation contains no correction or stated rule, THEN THE SYSTEM SHALL say so and ask what the rule should be — AC-12.3

## Quality Gates

- NFR-13: ≥ 8 of 10 new developers install and have a self-written rule block an action within 10 minutes (moderated test)
- Parity test in `evals/`: the skill's example drafts validate through Rules
- The skill warns that Hookify does not understand `ask` and `llm_evaluate` when a draft uses them

## Assumptions and open questions

- Open question to resolve here: what Hookify does with `action: ask` and an `llm_evaluate` condition — record it in research R2, CHANGELOG.md and the skill's warning.

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
