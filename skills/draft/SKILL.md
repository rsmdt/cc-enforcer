---
name: draft
description: Turn a correction or rule the user stated in this conversation into a cc-enforcer rule file (hookify.<name>.local.md), show the complete draft, and save it only after the user approves and picks the project or personal folder. Use when the user runs /cc-enforcer:draft or asks to make a correction into a rule.
---

# Draft a rule from the conversation

You turn something the user corrected or stated in this conversation into one rule file that cc-enforcer
enforces from the next tool call on. You write nothing until the user approves the draft.

## 1. Find the correction

Look back through the conversation for the most recent correction or stated rule: the user stopping or
undoing something Claude did ("don't edit applied migrations, add a new one"), a convention they spelled
out ("components live in `src/components/<Name>/`"), or a check they want every time ("never push to
main"). If the user passed text with the command, that text is the rule.

If there is no correction and no stated rule, say so plainly — "I found no correction or stated rule in
this conversation" — and ask what the rule should be. Do not invent one. Stop there and wait for the
answer.

## 2. Draft the complete rule file

Write one rule per file, named `hookify.<name>.local.md`. Fill in every part:

- **name** — short kebab-case, saying what the rule guards (`no-applied-migration-edits`).
- **event** — when it is checked: `bash` (a Bash command), `file` (Edit, Write, MultiEdit), `stop` (Claude
  ending its turn), `prompt` (a prompt the user submits) or `all` (every tool call, stop and prompt).
  Pick the narrowest event that catches the mistake.
- **action** — `block` stops the action and tells Claude why; `ask` pauses a tool call for the user's
  approval (only on `bash`, `file` or `all`); `warn` lets it run and hands Claude the message. Use
  `block` for what must never happen, `ask` when it is sometimes right, `warn` for a reminder.
- **tool_matcher** — optional: exact tool names separated by `|`, or `*`.
- **conditions** — all must hold. Each has a `field`, an `operator` and a `pattern`. For one regular
  expression on the event's main text, the simple form `pattern:` replaces `conditions`.
- **message** — the body after the frontmatter. Claude reads it when the rule applies, so say what is
  wrong and what to do instead; a message that names no allowed alternative leaves Claude guessing.

**Fields by event:**

| Event | Fields |
|-------|--------|
| `bash` | `command` |
| `file` | `file_path`; `new_text` (the new text of an Edit, the content of a Write, MultiEdit new strings); `old_text` (the replaced text); `content` (the Write content, else `new_text`) |
| any tool call | any key of the tool's input |
| `prompt` | `user_prompt` |
| `stop` | `transcript` (its last 32 KB) |

The simple `pattern` checks `command` on `bash`, `new_text` on `file`, `user_prompt` on `prompt` and
`transcript` on `stop`.

**Operators:** `regex_match` (case-insensitive, matches anywhere); `contains`, `equals`, `not_contains`,
`starts_with`, `ends_with` (literal, case-sensitive); `llm_evaluate`, whose pattern is a plain-language
yes/no question the user's model answers about the field ("Does this change an existing migration rather
than add a new one?"). Use `llm_evaluate` only when no pattern can say it, and pair it with a
`regex_match` that narrows where it is asked. `llm_evaluate` is not allowed on `stop`, and `ask` is not
allowed on `stop` or `prompt`.

**Regular expressions** are JavaScript regular expressions, always case-insensitive. Python forms
`(?P<name>…)`, `(?P=name)`, `\A`, `\Z` and a leading `(?i)`, `(?s)` or `(?m)` are accepted; other
Python-only syntax (atomic groups, possessive quantifiers, conditionals) makes the file invalid. Write
patterns unquoted in YAML; quote one only when it starts with a character YAML treats specially
(`*`, `&`, `!`, `[`, `{`, `>`, `|`, `@`, `` ` ``, `%`, `'`, `"`) or contains `: ` or ` #`.

## 3. Show the draft and ask

Show the whole file in one fenced block with its file name, then ask two things in one message:

1. Approve it as it is, or say what to change.
2. Save it to the **project** folder (the `.claude/` folder that holds this project's rules, shared
   with everyone on the project) or the **personal** folder (`~/.claude/`, every project on this
   machine).

Do not create, write or edit any file before the user approves. If they ask for changes, show the
revised complete file and ask again.

If the draft uses `ask` or `llm_evaluate`, add this warning under it:

> Hookify does not understand `ask` or `llm_evaluate`. If Hookify is also installed, it treats `ask` as `warn` (it shows the message and lets the action run), and a rule with an `llm_evaluate` condition never fires there.

## 4. Save on approval

After the user approves and names a folder:

1. Project: the nearest `.claude/` folder that already holds `hookify.*.local.md` files, searching from
   the working directory up to and including the git root (outside a repository, only the working
   directory's `.claude/`); cc-enforcer reads project rules from that one folder only. When no such
   folder exists, use `.claude/` at the git root, or in the working directory outside a repository.
   Never create a rule folder nearer than an existing one: the nearer folder would take over and the
   existing project rules would stop applying. Personal: `~/.claude/`. Create the folder if it does
   not exist.
2. If `hookify.<name>.local.md` already exists there, show the existing file and ask before replacing it.
3. Write the approved text exactly as shown, as `hookify.<name>.local.md`.
4. Tell the user where it was saved and that it applies from the next tool call — no restart needed. To
   switch it off later: `/cc-enforcer-toggle <name> off`; to list rules: `/cc-enforcer-rules`.

## Examples

A correction about migrations — never edit one that was applied:

```markdown hookify.no-applied-migration-edits.local.md
---
name: no-applied-migration-edits
event: file
action: block
tool_matcher: Edit|MultiEdit
conditions:
  - field: file_path
    operator: regex_match
    pattern: db/migrations/.*\.sql$
---
Applied migrations must not change. Add a new migration file in db/migrations/ that makes the change instead.
```

A command the user wants to approve each time:

```markdown hookify.confirm-force-push.local.md
---
name: confirm-force-push
event: bash
action: ask
pattern: git\s+push\s+.*(--force|-f\b)
---
Force-pushing rewrites shared history. Prefer `git push --force-with-lease`, or push a new commit instead.
```

A convention no pattern can state:

```markdown hookify.components-in-own-folder.local.md
---
name: components-in-own-folder
event: file
action: block
tool_matcher: Write
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx$
  - field: content
    operator: llm_evaluate
    pattern: Does this file define a React component outside a src/components/<Name>/ folder of its own?
---
Each component lives in src/components/<Name>/<Name>.tsx. Create the folder and put the component there instead.
```

A reminder at the end of a turn:

```markdown hookify.run-tests-before-done.local.md
---
name: run-tests-before-done
event: stop
action: warn
pattern: \b(done|finished|complete)\b
---
Run the test suite and report its result before saying the work is done.
```
