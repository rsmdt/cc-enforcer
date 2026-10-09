# Changelog

## 0.1.0 — unreleased

### Deliberate differences from Hookify

Rule files keep Hookify's format, but cc-enforcer fixes these Hookify defects on purpose, so a rule can
behave differently than it did under Hookify:

- `file` rules also match `Write` (Hookify never sees new text on `Write`).
- `prompt` rules see the submitted prompt (Hookify reads a field Claude Code does not send).
- A simple `pattern` on a `stop` rule matches the transcript (in Hookify it never matches).
- `bash` and `file` rules apply only to their own tools; other tools (Read, Grep, …) are checked only
  against `all` rules.
- Each tool call is checked once, not before and again after.
- Messages reach Claude, not only the user, and a `block` on a prompt stops the prompt.
- A file Hookify would misread (non-standard YAML, a value cut at `---` or a comma, conditions that lose
  their pattern) is reported as invalid rather than guessed.
- A failed check on a hard rule stops the tool call instead of letting it through.

A rule that was silently dead under Hookify can come alive under cc-enforcer; review `file`, `prompt`
and `stop` rules after switching.

### Overview and on/off

- `/cc-enforcer-rules` lists every rule with its name, event, action, whether it has an evaluator
  condition, source (project or personal), on/off state and hits this session.
- `/cc-enforcer-toggle <name> on|off [project|personal]` rewrites only the rule file's `enabled` line,
  and never overwrites a file edited since it was read.
- At session start cc-enforcer tells you when the Hookify plugin is also enabled: both would enforce the
  same rule files, so disable Hookify.

### Hookify and the new fields

cc-enforcer adds the `ask` action and the `llm_evaluate` operator to Hookify's rule format. Hookify does
not understand `ask` or `llm_evaluate`: it treats `ask` as `warn` (it shows the message to the user and
lets the action run), and a rule with an `llm_evaluate` condition never fires there, because Hookify
counts an unknown operator as a condition that does not hold. The `/cc-enforcer:draft` skill says so when
a draft uses either.
