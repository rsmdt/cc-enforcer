---
id: hr99kv
name: Plain-language conditions before a call
type: slice
status: building
parentId: m5921b
dependsOn: [ygxah1]
---
# Slice 5: Plain-language conditions before a call

`block` and `ask` rules with an `llm_evaluate` condition are judged by the model before the call; any failed check stops the call.

## Features

- AC-7.1 evaluation happens before the call; action applies only if it holds
- AC-7.2 no evaluation when a matcher fails
- AC-7.3 instructions in content are not followed
- AC-7.5 `llm_evaluate` on stop is invalid
- AC-9.1 a check that errors, times out or has no result stops the call and names the rule

## Behavior — EARS

- WHEN every matcher condition of an active `block` or `ask` rule with an evaluator holds for a tool call, THE SYSTEM SHALL obtain the evaluation before the call runs and apply the rule's action only if the evaluator condition holds — AC-7.1
- WHEN a matcher condition of a rule does not hold for a tool call, THE SYSTEM SHALL not request an evaluation for that rule — AC-7.2
- WHEN inspected content contains instructions addressed to the evaluator, THE SYSTEM SHALL reach the result on the rule alone and not follow those instructions, both before a call and in the batch review — AC-7.3
- IF a `stop` rule has an evaluator condition, THEN THE SYSTEM SHALL report it as invalid — AC-7.5
- WHEN an `all` rule with an evaluator condition would apply at a stop, THE SYSTEM SHALL not apply it there — FR-7 assumption
- IF the check of a matching `block` or `ask` rule errors, times out or the evaluation reaches no result, THEN THE SYSTEM SHALL stop the call and tell Claude which rule's check failed — AC-9.1
- IF the check of a hard rule fails, THEN THE SYSTEM SHALL stop the tool call instead of letting it through — AC-9.1

## Quality Gates

- NFR-2: calls with no evaluator rule in play add ≤ 10 ms p95; evaluated calls add ≤ 5 s p95
- NFR-3: ≥ 50 fault-injection cases (error, timeout, no result) on matching block/ask rules — 100% blocked
- NFR-5: ≥ 90% of violations caught, ≤ 5% of compliant actions flagged on ≥ 20+20 labelled actions per reference rule
- NFR-6: ≥ 95% of ≥ 50 injection-carrying violations still judged violating
- Model input uses a random delimiter absent from the content

## Assumptions and open questions

- [ASSUMPTION] Field limits: at most 4 KB of a field is evaluated (Standing).
- Open question to resolve here: does `$.model.classify` reject or return undefined on failure? Treat both as no result.

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
