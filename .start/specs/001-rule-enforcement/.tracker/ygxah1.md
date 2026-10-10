---
id: ygxah1
name: Block rules stop tool calls
type: slice
status: passed
parentId: m5921b
dependsOn: []
---
# Slice 1: Block rules stop tool calls

An existing Hookify `block` rule from the project or personal folder stops a matching tool call in the main session or a subagent, and Claude receives the rule's message.

## Features

- AC-1.1 valid rule files are active at session start
- AC-1.2 an invalid file is reported with the file and problem; other rules still apply
- AC-1.3 a missing name defaults to the file-name part
- AC-1.4 Hookify-format rules match and act as documented, except the listed differences
- AC-2.1 project and personal rules are both active and each shows its source
- AC-2.2 same-name copies are checked separately; strictest matching action governs
- AC-2.3 project rules apply from a subdirectory
- AC-5.1 a matching main-session call does not run; Claude gets the rule's name and message
- AC-5.2 a matching subagent call does not run; the subagent gets the same message
- AC-5.3 a non-matching call runs unaffected

## Behavior — EARS

- WHEN a session starts, THE SYSTEM SHALL activate every valid rule file in both rule folders with the event, action and conditions it declares — AC-1.1
- IF a rule file fails validation, THEN THE SYSTEM SHALL report the file and the problem to the user and keep applying every other rule — AC-1.2
- IF a rule file is one Hookify would misread (non-standard YAML, a value cut at `---` or a comma, a condition without its pattern), THEN THE SYSTEM SHALL report it as invalid — AC-1.2
- WHEN a rule file declares no name, THE SYSTEM SHALL use the part of the file name between `hookify.` and `.local.md` — AC-1.3
- WHEN an action is checked against a rule that uses only Hookify's fields and operators, THE SYSTEM SHALL match and act as Hookify's documented format describes, except for the PRD's listed differences — AC-1.4
- WHEN a `Write` call is checked against a `file` rule, THE SYSTEM SHALL use the written content as `new_text` and `content` — AC-1.4
- WHEN a tool other than `Bash`, `Edit`, `Write` or `MultiEdit` is called, THE SYSTEM SHALL check it only against `all` rules — AC-1.4
- WHEN a rule blocks a tool call, THE SYSTEM SHALL give Claude the rule's message — AC-5.1
- THE SYSTEM SHALL match each field on its first 32 KB, the transcript on its last 32 KB, and evaluate at most 4 KB of a field — PRD Constraints
- WHEN a session starts, THE SYSTEM SHALL load rules from the project and personal folders and record each rule's source — AC-2.1
- THE SYSTEM SHALL never load the personal folder as the project folder — AC-2.1
- WHEN the project and personal folders define the same rule name, THE SYSTEM SHALL check each copy on its own conditions and apply the strictest action among the copies that match — AC-2.2
- WHILE the working directory is below the project root, THE SYSTEM SHALL find the project's rules by searching upward from the working directory, no further than the git root — AC-2.3
- IF the working directory is not in a git repository, THEN THE SYSTEM SHALL read project rules only from the working directory's `.claude/` — AC-2.3
- WHEN a main-session tool call matches an active `block` rule, THE SYSTEM SHALL stop the call and return the rule's name and message to Claude — AC-5.1
- WHEN a subagent's tool call matches an active `block` rule, THE SYSTEM SHALL stop the call and return the same message to the subagent — AC-5.2
- WHEN a tool call matches no active rule, THE SYSTEM SHALL let it run unchanged — AC-5.3
- WHEN an agent the Workflow tool started, or a background agent, makes a tool call that matches an active `block` rule, THE SYSTEM SHALL stop it and log it with the agent label "workflow agent" or the agent's name — FR-5 assumption, NFR-4
- IF the enforcer fails before deciding a tool call, THEN THE SYSTEM SHALL stop the call, naming the rules being checked when known — AC-9.1
- THE SYSTEM SHALL record each rule hit and finding in a local per-session log that holds no file content, prompt text or command text and is sent nowhere — DR-6

## Quality Gates

- NFR-1: with 100 active matcher-only rules, added time per tool call ≤ 50 ms at p95 over 1,000 reference calls
- NFR-4: `block` rules stop 100% of matching calls across main session, subagents and background agents in the reference set
- NFR-9: 100% of block messages name the rule and carry its body
- NFR-16: the slice's scenarios pass on Claude Code v2.1.287 and the latest release
- NFR-17: on ≥ 30 Hookify rule files and ≥ 300 actions, match decision and action equal Hookify's outside the listed differences
- Baseline: unit tests for parsing, validation, field mapping and regex translation; lint and type check clean

## Assumptions and open questions

- [ASSUMPTION] Trust scope: trusting the working directory covers project rules in `.claude/` folders up to the git root (Standing).
- [ASSUMPTION] Workflow-tool agents are enforced but logged as "workflow agent" (Standing).
- [ASSUMPTION] Field limits 32 KB / 4 KB (Standing, PRD Constraints).
- Open question to resolve here: can `$.fs.write` create the log owner-only under `~/.cc-enforcer/`? If not, use the plugin data folder and document its permissions.

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
