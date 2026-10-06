---
title: "cc-enforcer — project conventions and quality gates for Claude Code"
status: draft
threshold: 0.90
max_iterations: 3
version: 0.1.0
---

# Implementation Plan: cc-enforcer

> [!NOTE]
> This is the **high-level approach** for `/implement` — phases and the outcomes they achieve.
> It is read for orientation, **not parsed for work**. The operational units are **tasks** in the
> spec's tracker: a phase root, one **slice** task per vertical deliverable (its body is the code
> brief — features + EARS behavior + quality gates), and under each slice its **scenario** child
> tasks (the holdout acceptance evidence). `/implement` reads those tasks and builds each slice
> through a barriered code→eval loop, retrying until its scenarios pass at the `threshold`.

## Target State

cc-enforcer is one Claude Code plugin in its own repository: a mod, a `rules` module and a drafting
skill. In any Claude Code session (v2.1.287+) it reads the Hookify rule files a developer already has —
`hookify.*.local.md` in the project's `.claude/` (searched up to the git root) and in the personal
`~/.claude/` — and enforces them through Claude Code Mods. A `block` rule stops a matching tool call
before it runs and tells Claude why and what to do instead, in the main session and in subagents; an
`ask` rule pauses the call for the user; a `warn` rule lets it run and hands Claude the finding with the
result. Conditions can be plain-language questions (`llm_evaluate`) answered by the user's own model,
before a call for hard rules and in a batch at turn end for `warn` rules, whose findings the user can
send to Claude from a band above the prompt. `stop` and `prompt` rules keep Claude working or stop a
prompt. A failing check never lets a hard-rule violation through. Rules update without restarting, can be
switched on and off, are listed with their hits in an overview, and can be drafted from the conversation.

## Phases & Outcomes

1. **Block rules stop tool calls** — an existing Hookify `block` rule from the project or personal folder stops a matching tool call in the main session or a subagent, and Claude receives the rule's message. _Depends on: none._
2. **Live rule updates** — a rule file added, changed or deleted mid-session applies to the next tool call; a broken edit keeps the last good version and tells the user. _Depends on: (1)._
3. **Ask rules** — an `ask` rule pauses a matching tool call for the user's approval; headless runs block. _Depends on: (1)._
4. **Warn findings on tool results** — a matcher-only `warn` rule lets the call run and Claude reads the finding with the result. _Depends on: (1)._
5. **Plain-language conditions before a call** — `block`/`ask` rules with an `llm_evaluate` condition are judged by the model before the call; any failed check stops the call. _Depends on: (1)._
6. **Turn-end review of warn conditions** — `warn` rules with an `llm_evaluate` condition are reviewed at turn end; findings appear to the user, who can send them to Claude. _Depends on: (4), (5)._
7. **Stop rules** — a `stop` rule keeps Claude working (with a loop guard) or shows a warning as the turn ends. _Depends on: (1)._
8. **Prompt rules** — a `prompt` rule drops a submitted prompt or adds context to it, including plain-language conditions. _Depends on: (5)._
9. **Overview and on/off** — the user lists every rule with its source, state and hits, switches rules on and off, and is told when Hookify is also enabled. _Depends on: (1)._
10. **Draft a rule from the conversation** — `/cc-enforcer:draft` turns a correction into an approved rule file that applies at once. _Depends on: (1)._

## Tracking

Tasks and live status: `.start/specs/001-rule-enforcement/.tracker/` (`task.js graph --spec 001`).
Each slice task carries its code brief; its scenario child tasks carry the holdout evidence.

## Open Questions

None that change what "done" looks like. The solution's open questions are each resolved by the slice
that first needs them: the shape of a failed `$.model.classify` (slice 5), owner-only log files through
`$.fs.write` (slice 1), the Stop input's `last_assistant_message` or a ranged read (slice 7), and how
Hookify treats `ask` and `llm_evaluate` (slice 10).
