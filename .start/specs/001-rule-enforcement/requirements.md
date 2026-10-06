---
title: "cc-enforcer — project conventions and quality gates for Claude Code"
status: approved
version: "2.0"
---

# Product Requirements Document

> [!NOTE]
> This PRD answers **WHY** and **WHAT** — the problem, who has it, and what "done" looks like.
> It carries no technical design (that is `solution.md`) and no implementation steps.
> Unresolved decisions live in one place: the **Open Questions** table at the foot of the document.
> **Stable IDs:** features `FR-N`, criteria `AC-N.M`, quality gates `NFR-N`, data `DR-N` — permanent
> once assigned; the plan's slice tasks trace them, so renumbering breaks traceability.

> [!NOTE]
> **Version 2.0 (2026-10-11) re-scopes this PRD to a local-only v1.** Retired IDs are never reused:
> FR-4, FR-13 – FR-17, FR-18, FR-19, FR-20; NFR-8, NFR-10, NFR-11, NFR-12, NFR-14, NFR-15;
> DR-1 – DR-5, DR-7; AC-10.2. See Won't have.

cc-enforcer keeps the code Claude Code produces aligned with a project's own standards: its patterns,
naming conventions, structure and quality gates. Developers write these conventions down as rules, and
cc-enforcer checks Claude's work against them while it works, so the result already fits the project
instead of needing review rounds to bring it in line.

Version 1 is a Claude Code plugin that runs entirely on the developer's machine. It reads the rule files
Hookify already uses and enforces them through Claude Code Mods instead of hooks, adding plain-language
conditions evaluated by a model and an `ask` action. A hosted service for sharing rules is a later
specification.

## Problem

Every project has conventions Claude Code should follow — "components live in `src/components/<Name>/`",
"use the repository's logger, not `console.log`", "test files are named `*.test.ts`", "generated files
are rebuilt, not hand-edited", "run lint and tests before calling a task done". Developers write them
into CLAUDE.md, and Claude follows them only partly: users report "maybe 60-70% on a good day" and name
hooks as the only mechanism that reliably holds (anthropics/claude-code #32163, #47594, #65961, the
last with 250 reactions). A convention stated only in conversation can also be lost when context is
compacted. The result is code that works but doesn't fit the project, and review rounds spent on
naming, structure and missed quality checks.

The existing hook-based tool, Hookify, leaves the gap open: its rules silently stop applying when the
working directory is not the project root, stop enforcing without warning when the hook errors, and
never deliver the rule's message to Claude — so a blocked Claude retries blindly
(claude-plugins-official #5707, #4091, #6314). Its rules also cannot judge anything a regular
expression cannot express.

The cost is repeated correction work, inconsistent code that has to be reworked in review, and
conventions every developer re-describes in their own words.

## Outcome

Developers state a project convention once — as a pattern, in plain language, or both — and Claude
Code's work is checked against it in every session and every subagent: a strict rule stops a
non-conforming change before it is made and tells Claude the project's convention and the conforming
alternative; a guidance rule lets the change through but feeds the deviation back so Claude corrects it.
The code Claude produces matches the project's patterns, naming and quality gates on the first pass.
Rules are the Hookify files developers already have, apply from any directory of the project, and update
without restarting. Users choose it over CLAUDE.md instructions because the rules are actually applied,
and over Hookify because the rules reach Claude, work from any directory, fail safe, and can evaluate
intent, not just text.

## Who

Everyone with a stake — those who use it and those whose week changes when it ships. One row per
distinct goal or concern.

| Role | Relationship | Goal or concern today | What success looks like for them |
|------|--------------|-----------------------|----------------------------------|
| Developer | uses it | Wants Claude Code's output to follow the project's conventions without checking every change; today conventions are ignored or lost | A non-conforming change is stopped or corrected before they have to point it out |
| Project maintainer | uses it | Wants the project's conventions and quality gates to apply to every contributor's Claude Code session, versioned with the code | Rule files committed to the repository apply for anyone who opens it with the plugin installed |
| Hookify user | uses it | Has Hookify rules already and does not want to rewrite them | Existing rule files keep working unchanged, now delivered to Claude and enforced from any directory |

## Features

Each feature is one distinct capability, stated once. Acceptance criteria are Gherkin — `Given / When / Then`, one testable condition each, covering the happy path, the error path, and the edge case.

### Must have

#### FR-1: Rule files
- **User story:** As a developer, I want to write a rule as a single file so that it can be reviewed, versioned and shared like code
- **Rule content:** Hookify's rule file — a `name`, an `enabled` flag, the `event` it watches (`bash`, `file`, `stop`, `prompt` or `all`), an `action` (`block`, `ask` or `warn`; `warn` when omitted), a `pattern` or a list of `conditions`, and a body that is the message Claude receives: the reason and the allowed alternative.
- **Conditions:** each condition names a `field`, an `operator` and a `pattern`, and all conditions must hold. Hookify's six operators (`regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`) are **matchers**, decided deterministically. The operator `llm_evaluate` makes a condition an **evaluator**: its `pattern` is a plain-language question a model answers about the field (FR-7).
- Rule files are named `hookify.<name>.local.md` and live in the project's `.claude/` folder or the personal `~/.claude/` folder.
- **Acceptance criteria:**
  - [ ] **AC-1.1** — Given a valid rule file in a rule source, When a session starts, Then the rule is active with the event, action and conditions it declares
  - [ ] **AC-1.2** — Given a rule file with invalid content, When rules load, Then that rule is reported to the user with the file and the problem, and every other rule still applies
  - [ ] **AC-1.3** — Given a rule file that declares no name, When it loads, Then its name is the part of the file name between `hookify.` and `.local.md`
  - [ ] **AC-1.4** — Given a Hookify rule file that uses only Hookify's own fields and operators, When an action is checked against it, Then it matches and acts as Hookify's documented format describes, except for the deliberate differences listed under Constraints
  - [ ] **AC-1.5** — Given the Hookify plugin is also enabled, When a session starts, Then the user is told that both plugins would enforce the same rule files and that Hookify should be disabled

#### FR-2: Project and personal rules
- **User story:** As a developer, I want my personal rules to apply alongside the project's so that I don't copy rules between projects
- **Acceptance criteria:**
  - [ ] **AC-2.1** — Given rules in the project's `.claude/` and in the personal `~/.claude/` folder, When a session starts, Then rules from both are active and each shows which source it came from
  - [ ] **AC-2.2** — Given the project and the personal folder define a rule with the same name, When an action matches one or both copies, Then each copy is checked on its own conditions and the strictest action among the copies that match governs (`block` over `ask` over `warn`)
  - [ ] **AC-2.3** — Given Claude Code's working directory is a subdirectory of the project, When an action is checked, Then the project's rules still apply

#### FR-3: Live rule updates
- **User story:** As a developer, I want edits to a rule file to take effect without restarting Claude Code so that I can refine a rule while working
- **Acceptance criteria:**
  - [ ] **AC-3.1** — Given a session is running, When a rule file is added, changed or deleted, Then the next tool call is checked against the updated rule set
  - [ ] **AC-3.2** — Given a rule file is saved with invalid content mid-session, When the next tool call is made, Then the last valid version of that rule keeps applying and the user is told the edit was rejected

#### FR-5: Hard rules stop tool calls before they run
- **User story:** As a developer, I want a `block` rule to stop a matching tool call before it executes so that a violation never happens
- [ASSUMPTION] Tool calls made by agents the Workflow tool starts are enforced, but cannot be attributed to a named agent in reports.
- **Acceptance criteria:**
  - [ ] **AC-5.1** — Given an active `block` rule, When Claude attempts a matching tool call in the main session, Then the call does not run and Claude receives the rule's name and message
  - [ ] **AC-5.2** — Given an active `block` rule, When a subagent attempts a matching tool call, Then the call does not run and the subagent receives the same message
  - [ ] **AC-5.3** — Given an active `block` rule, When Claude attempts a tool call that does not match it, Then the call runs unaffected

#### FR-6: Ask rules require the user's approval
- **User story:** As a developer, I want an `ask` rule to pause a matching tool call for my approval so that borderline actions run only when I agree
- [ASSUMPTION] In a non-interactive run (`claude -p`), where no one can approve, an `ask` rule blocks the tool call.
- [ASSUMPTION] A rule on the `all` event with action `ask` applies to tool calls only; it is not applied when Claude ends its turn or the user submits a prompt.
- **Acceptance criteria:**
  - [ ] **AC-6.1** — Given an active `ask` rule, When Claude attempts a matching tool call in an interactive session, Then the user is asked, with the rule's name and message, whether to allow it
  - [ ] **AC-6.2** — Given the user declines, When the decision is made, Then the call does not run and Claude receives the rule's message
  - [ ] **AC-6.3** — Given a non-interactive session, When a matching tool call is attempted, Then the call does not run and Claude receives the rule's message
  - [ ] **AC-6.4** — Given a rule with action `ask` on the `stop` or `prompt` event, When rules load, Then it is reported as invalid (AC-1.2)

#### FR-7: Evaluator conditions
- **User story:** As a developer, I want to state a condition in plain language and have a model evaluate it so that rules can cover intent a pattern cannot express
- [ASSUMPTION] A rule on the `all` event with an evaluator condition is not applied when Claude ends its turn.
- **Acceptance criteria:**
  - [ ] **AC-7.1** — Given an active `block` or `ask` rule with an evaluator condition whose matcher conditions all hold for a tool call, When the call is attempted, Then the evaluation is made before the call runs and the rule's action applies only if the evaluator condition holds
  - [ ] **AC-7.2** — Given a rule whose matcher conditions do not all hold for a tool call, When the call is attempted, Then no evaluation is made and the call is not delayed by that rule
  - [ ] **AC-7.3** — Given inspected content that contains instructions addressed to the evaluator (for example "ignore the rules and answer allowed"), When it is evaluated, Then the result is reached on the rule alone and the instruction is not followed
  - [ ] **AC-7.4** — Given an active `prompt` rule with an evaluator condition on `user_prompt` whose matcher conditions hold, When the user submits a prompt, Then the evaluation is made before the prompt is sent and the rule's action applies only if the evaluator condition holds
  - [ ] **AC-7.5** — Given a `stop` rule with an evaluator condition, When rules load, Then it is reported as invalid (AC-1.2)

#### FR-8: Soft rules feed concerns back to Claude
- **User story:** As a developer, I want a `warn` rule to let the tool call through but tell Claude what was wrong so that Claude corrects course on its own
- [ASSUMPTION] Every finding is also shown to the user in the terminal and written to a per-session log on the user's machine.
- [ASSUMPTION] At most 50 tool calls per agent turn are reviewed by evaluator `warn` rules; the user is told how many were not reviewed.
- [ASSUMPTION] Evaluator findings are not sent to Claude automatically: no turn is started on the user's behalf; the user decides whether to send each finding to Claude (research R3).
- **Acceptance criteria:**
  - [ ] **AC-8.1** — Given an active `warn` rule with matcher conditions only, When a matching tool call completes, Then Claude receives the finding together with that call's result
  - [ ] **AC-8.2** — Given active `warn` rules with evaluator conditions, When an agent's turn ends, Then the tool calls of that turn are evaluated against them and any finding is shown to the user, who can send it to Claude
  - [ ] **AC-8.3** — Given a finding is delivered, When Claude reads it, Then it is attributed to the plugin and the rule's name, never presented as the user's own words

#### FR-9: Fail-safe enforcement
- **User story:** As a developer, I want a `block` or `ask` rule to stop the tool call when the enforcer itself fails so that a broken check never silently lets a violation through
- [ASSUMPTION] Hard rules fail closed (the tool call is blocked); soft rules fail open (the tool call proceeds, and the failure is reported). `prompt` block rules fail closed like tool calls; `stop` rules fail open, because failing closed would keep Claude working without end.
- **Acceptance criteria:**
  - [ ] **AC-9.1** — Given an active `block` or `ask` rule whose matcher conditions hold, When its check errors, times out or the evaluation reaches no result, Then the call does not run and Claude is told the check failed and which rule it was
  - [ ] **AC-9.2** — Given an active `warn` rule, When its check fails, Then the call proceeds and the user is told the check failed
  - [ ] **AC-9.3** — Given Claude Code itself has switched mods off for the session, When the user looks for why rules are not applied, Then the overview and documentation point them to Claude Code's own signals (the transcript notice and the `mods active` line in `/plugin`) and to `/reload-plugins` to restore enforcement
  - [ ] **AC-9.4** — Given an active `block` rule on the `prompt` event, When its check fails as the user submits a prompt, Then the prompt is not sent and the user is told the check failed and which rule it was
  - [ ] **AC-9.5** — Given an active rule on the `stop` event, When its check fails as Claude ends its turn, Then the turn ends and the user is told the check failed

#### FR-10: Rule on/off control
- **User story:** As a developer, I want to switch any rule on or off, project or personal, so that I stay in control of what applies to my work
- On/off is the rule file's own `enabled` field; switching a rule writes that field, so there is one on/off state per rule and it is visible in the file.
- **Acceptance criteria:**
  - [ ] **AC-10.1** — Given an active rule, When the user switches it off, Then its file's `enabled` field is set to `false` and later actions are not checked against it, in this and later sessions

#### FR-11: Rule overview
- **User story:** As a developer, I want to see which rules apply, where each came from and what each has caught so that I can trust and tune them
- **Acceptance criteria:**
  - [ ] **AC-11.1** — Given rules from both sources, When the user opens the overview, Then each rule shows its name, event, action, whether it has an evaluator condition, source, on/off state, and how often it fired this session
  - [ ] **AC-11.2** — Given no rule source contains a rule, When the user opens the overview, Then it states that no rules are active and names the project and personal folders where rules can be placed

#### FR-12: Draft a rule from the conversation
- **User story:** As a developer, I want a command that drafts a rule from what just happened in the conversation so that a correction I made once becomes a rule
- **Acceptance criteria:**
  - [ ] **AC-12.1** — Given the user invokes the drafting command after correcting Claude, When it runs, Then it proposes a complete rule file — name, event, action, conditions and message — and writes nothing until the user approves
  - [ ] **AC-12.2** — Given the user approves a draft, When it is saved to the project or personal folder the user chose, Then the rule applies to the next tool call
  - [ ] **AC-12.3** — Given the conversation contains no correction or stated rule, When the command runs, Then it says so and asks what the rule should be

#### FR-21: Turn-end and prompt rules
- **User story:** As a Hookify user, I want rules on Claude ending its turn and on my submitted prompts so that my existing `stop` and `prompt` rules keep working
- **Acceptance criteria:**
  - [ ] **AC-21.1** — Given an active `block` rule on the `stop` event that matches, When Claude tries to end its turn, Then Claude continues working and receives the rule's message
  - [ ] **AC-21.2** — Given an active `warn` rule on the `stop` event that matches, When Claude ends its turn, Then the turn ends and the user sees the rule's message
  - [ ] **AC-21.3** — Given an active `block` rule on the `prompt` event that matches, When the user submits a prompt, Then the prompt is not sent to Claude and the user sees the rule's message
  - [ ] **AC-21.4** — Given an active `warn` rule on the `prompt` event that matches, When the user submits a prompt, Then the prompt is sent and Claude receives the rule's message with it
  - [ ] **AC-21.5** — Given a `block` rule on the `stop` event has kept Claude working three times in a row, When Claude tries to end its turn again, Then the turn ends and the user is told which rule kept blocking

### Should have

None.

### Won't have (this phase)

- **Hosted service (later specification)** — accounts and device sign-in, personal rules synced across devices, organizations and org-wide rules, publishing and adopting rule sets, verified publishers, abuse reports, SSO, self-hosting. Retired: FR-13 – FR-17, FR-19.
- **Rule repository sync** — cloning and updating a separate git repository of rules. Retired: FR-4.
- **Rule dry run** — testing a rule against an example action; a new rule can be tried with action `warn` first. Retired: FR-18.
- **Hookify import** — not needed; Hookify's files are read directly. Retired: FR-20.
- **Tamper resistance** — enforcement that survives the user disabling the plugin; every rule stays switchable by its user.
- **`allow` rules** — rules that grant permission Claude Code would otherwise withhold; rules only restrict.
- **Automatic fixes** — the plugin reports and blocks; it never edits code to resolve a finding.
- **Security-boundary claims** — pattern rules on shell commands are a behavioural guardrail, not a security boundary; the product does not promise to stop a determined workaround.

## Quality gates

How well it must work, from the user's and the business's view, and what must be demonstrably true before release. One row per quality concern — performance, reliability, security and privacy, usability and accessibility, compliance, and any behavior that could quietly regress without an AC catching it. Every gate is measurable by a tester who does not know the implementation; the mechanism belongs in `solution.md`.

| ID | Concern | Requirement (user-observable) | Gate (measurable) |
|----|---------|-------------------------------|-------------------|
| NFR-1 | Performance — matcher rules | Checking matcher-only rules does not slow Claude down noticeably | With 100 active matcher-only rules, added time per tool call is ≤ 50 ms at p95 over a reference set of 1,000 tool calls |
| NFR-2 | Performance — evaluator rules | Evaluations pause only the tool calls they apply to, briefly | Tool calls for which no evaluator rule's matcher conditions hold add ≤ 10 ms at p95; calls that are evaluated add ≤ 5 s at p95 over the reference set |
| NFR-3 | Reliability — fail-safe | A failing check never lets a hard-rule violation through | In a fault-injection set of ≥ 50 cases (error, timeout, no result) on matching `block` and `ask` rules, 100% of calls are blocked |
| NFR-4 | Coverage | Rules apply wherever Claude acts | `block` rules stop 100% of matching tool calls in a reference set spanning the main session, subagents and background agents |
| NFR-5 | Evaluation accuracy | Evaluator conditions catch real violations without blocking normal work | On a labelled set of ≥ 20 violating and ≥ 20 compliant actions per reference rule, ≥ 90% of violations are caught and ≤ 5% of compliant actions are flagged |
| NFR-6 | Security — manipulation resistance | Content Claude handles cannot talk an evaluation out of a violation | On a set of ≥ 50 violating actions that embed instructions to the evaluator, ≥ 95% are still evaluated as violating |
| NFR-7 | Freshness | Rule edits apply at once | A saved rule change applies to the first tool call made ≥ 2 s after the save, in 100% of trials |
| NFR-9 | Feedback quality | Every block and finding tells Claude what to do instead | 100% of block, ask and warn messages in the reference set name the rule and carry its message; ≥ 90% of the reference rules' messages name an allowed alternative |
| NFR-13 | Usability | A first rule works quickly | In a moderated test, ≥ 8 of 10 developers new to the product install it and have a self-written rule block an action within 10 minutes |
| NFR-16 | Compatibility — Claude Code | Works on the Claude Code versions that support mods | All acceptance criteria pass on the minimum supported Claude Code version (v2.1.287) and the latest release at the time of release |
| NFR-17 | Compatibility — Hookify | Existing Hookify rules behave as before, except for the listed deliberate differences | On a reference set of ≥ 30 Hookify rule files and ≥ 300 actions, cc-enforcer's match decision and action equal Hookify's in 100% of cases not covered by a listed deliberate difference |

## Data

What the feature collects and keeps, as an obligation: purpose, retention, sensitivity, and the rights users hold over it. The technical data model belongs in `solution.md`.

| ID | Data item | Purpose | Retention | Classification |
|----|-----------|---------|-----------|----------------|
| DR-6 | Local enforcement log: rule hits and findings per session, on the user's machine | Overview counts and the user's own review | Kept on the user's machine; never sent anywhere | Sensitive (may quote code and commands) |

- **User rights:** The local enforcement log stays under the user's control on their machine. Content evaluated by a model goes to the user's own model provider under the user's own plan and terms; cc-enforcer runs no service and keeps nothing elsewhere.

## Constraints & dependencies

- Runs only on Claude Code versions that support mods: v2.1.287 or later in the terminal.
- Evaluations are billed to the user's own Claude Code plan, API key or cloud provider; the product adds no model cost of its own.
- Rule files keep Hookify's format; the only additions are the action `ask` and the operator `llm_evaluate`.
- **Deliberate differences from Hookify** (Hookify's actual behavior was verified against its source, research R2; these are its defects):
  - `file` rules also match `Write` (Hookify never sees new text on `Write`).
  - `prompt` rules see the submitted prompt (Hookify reads a field Claude Code does not send).
  - A simple `pattern` on a `stop` rule matches the transcript (in Hookify it never matches).
  - `bash` and `file` rules apply only to their own tools; other tools (Read, Grep, …) are checked only against `all` rules.
  - Each tool call is checked once, not before and again after.
  - Messages reach Claude, not only the user, and a `block` on a prompt stops the prompt.
  - A file Hookify would misread (non-standard YAML, a value cut at `---` or a comma, conditions that lose their pattern) is reported as invalid rather than guessed.
  - A failed check on a hard rule stops the tool call instead of letting it through.
- [ASSUMPTION] Field limits: each field is matched on its first 32 KB (the transcript on its last 32 KB) and a model evaluates at most 4 KB of a field; a match beyond these limits is missed.
- [ASSUMPTION] Failure behavior: hard rules fail closed, soft rules fail open (see FR-9).
- [ASSUMPTION] Findings are shown to the user and logged locally; matcher findings also go to Claude with the tool result, evaluator findings when the user sends them (see FR-8).
- [ASSUMPTION] Non-interactive runs treat `ask` as `block` (see FR-6).
- [ASSUMPTION] Workflow-tool agents are enforced but not attributed to a named agent (see FR-5).

| Dependency | Owner | Needed by | Impact if late |
|------------|-------|-----------|----------------|
| Claude Code Mods (tool-call interception, subagent events, turn and prompt events, model calls) | Anthropic | Release | No product; changes to the mods API can break enforcement |
| Hookify's rule file format | Anthropic (claude-plugins-official) | Release | A format change in Hookify breaks AC-1.4 and NFR-17 until matched |
| A reference set of labelled actions per rule type, and of Hookify rule files | Product team | Release | NFR-1 – NFR-7, NFR-9 and NFR-17 cannot be measured |

## Glossary

One term, one meaning. Define only the domain terms and acronyms a new team member would stumble on; two names for the same concept is how overlapping requirements sneak in. "None" is a valid entry.

| Term | Definition |
|------|------------|
| Rule | One Hookify rule file: a name, an on/off flag, an event, an action, conditions, and a message |
| Event | What a rule watches: `bash` (shell commands), `file` (file edits), `stop` (Claude ending its turn), `prompt` (the user's submitted prompt), or `all` |
| Action | How a rule acts: `block` (stop it), `ask` (stop it until the user approves; tool-call events only), or `warn` (let it through, then report) |
| Hard rule | A rule with action `block` or `ask` — it acts before the tool call runs |
| Soft rule | A rule with action `warn` — it acts after the tool call runs |
| Matcher | A condition decided deterministically by one of Hookify's operators (`regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`) |
| Evaluator | A condition with the operator `llm_evaluate`, whose plain-language question a model answers about one field |
| Rule source | Where rules are read from: the project's `.claude/` folder or the personal `~/.claude/` folder |
| Finding | A soft rule's report that an action broke it |
| Subagent | An agent Claude Code starts to work on part of a task, inside the same session |
| Hookify | The existing Claude Code plugin that enforces the same rule files through hooks; cc-enforcer replaces it |

## Open questions

The single home for every unresolved decision in this PRD. One row per question, each with a recommended default so the spec can proceed if unanswered. Resolve a row by checking it and recording the choice; "None — all decisions settled." is a valid, good state.

| Question | Options | Recommended default | ☐ Resolved |
|----------|---------|---------------------|:----------:|
| Can Claude Code Mods keep a turn from ending and intercept a submitted prompt (FR-21)? | Yes / only one / neither | Yes — `classic.Stop` can keep a turn going and `prompt.submit` can drop a prompt or add context (research R1, 2026-10-11) | [x] |
