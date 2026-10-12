# cc-enforcer

A Claude Code plugin that enforces Hookify rule files through Claude Code mods. Strict rules stop an
action that breaks a convention and tell Claude the conforming alternative; guidance rules let the action
through and tell Claude what to fix.

## Setup

1. Install the plugin in Claude Code (v2.1.287 or later, in the terminal).
2. Disable the Hookify plugin if it is enabled. Both plugins read the same rule files, so every rule would
   apply twice; cc-enforcer reminds you at session start while Hookify is on.
3. Put rule files in either folder:
   - **Project:** `.claude/` in your project (the nearest `.claude/` holding rule files, from the working
     directory up to the git root).
   - **Personal:** `~/.claude/`.

## Rule format

Each rule is a file named `hookify.<name>.local.md`, in Hookify's format:

```markdown
---
name: no-force-push
enabled: true
event: bash
action: block
pattern: git push .*--force
---
Never force-push. Push to a new branch and open a pull request.
```

- `event`: `bash`, `file`, `stop`, `prompt` or `all`.
- `action`: `block` (stop the action), `ask` (ask you first) or `warn` (let it run and tell Claude).
- `pattern`, or `conditions` (a list of `field`, `operator`, `pattern`). Operators: `regex_match`,
  `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`, and `llm_evaluate`, a plain-language
  question a model answers.
- The body is the message Claude gets.

`ask` and `llm_evaluate` are cc-enforcer additions that Hookify does not understand. `CHANGELOG.md` lists
them and every deliberate difference from Hookify's behavior.

## Overview and on/off

- `/cc-enforcer-rules` lists each rule's name, event, action, whether it has an evaluator condition,
  source (project or personal), on/off state and hits this session. With no rules it names the project
  and personal folders where rules can go.
- `/cc-enforcer-toggle <name> on|off [project|personal]` switches a rule by rewriting only its file's
  `enabled` line; the change applies at once and in later sessions. When the name exists in both
  folders, give the source. An unknown name, a missing source, or a file edited since it was read changes
  nothing and the command says why.

## When rules stop applying

If rules stop applying, Claude Code may have switched mods off for this session. Look for its notice in the transcript and for the `mods active` line in /plugin, then run /reload-plugins to restore enforcement.

## Event log

Every enforcement event is written to `~/.cc-enforcer/projects/<project-path>/<session-id>.jsonl`
(owner-only), the same shape as `~/.claude/projects/`. The log holds each tool call with its full input,
including calls no rule covers, every prompt, every turn end, and each rule hit and finding. It is sent
nowhere. A resumed session reads it back, so the audit pane keeps its history.

The log keeps commands, prompts and file content, which can include secrets. Remove old logs with
`/cc-enforcer-cleanup [period]`, for example `/cc-enforcer-cleanup last week`; without a period it removes
logs older than 180 days.
