---
id: 8uk9au
name: Overview and on/off
type: slice
status: failed
parentId: m5921b
dependsOn: [ygxah1]
---
# Slice 9: Overview and on/off

The user lists every rule with its source, state and hits, switches rules on and off, and is told when Hookify is also enabled.

## Features

- AC-11.1 overview lists name, event, action, evaluator, source, on/off and hits
- AC-11.2 empty overview names the folders
- AC-10.1 switching off writes `enabled: false` and stops checking it
- AC-9.3 overview and docs point to Claude Code's mods-off signals
- AC-1.5 the user is told when Hookify is also enabled

## Behavior — EARS

- WHEN the user opens the overview, THE SYSTEM SHALL list each rule's name, event, action, whether it has an evaluator, source, on/off state and hits this session — AC-11.1
- IF neither rule folder contains a rule, THEN THE SYSTEM SHALL say no rules are active and name the project and personal folders — AC-11.2
- WHEN the user switches a rule off, THE SYSTEM SHALL set its file's `enabled` field to `false` and stop checking it in this and later sessions — AC-10.1
- IF the named rule does not exist, or exists in both folders and no source is given, THEN THE SYSTEM SHALL change nothing and tell the user why — AC-10.1
- WHERE the user opens the overview or documentation, THE SYSTEM SHALL point to Claude Code's own signals for mods switched off in a session (the transcript notice and the `mods active` line in `/plugin`) and to `/reload-plugins` — AC-9.3
- WHEN a session starts while the Hookify plugin is enabled, THE SYSTEM SHALL tell the user that both plugins would enforce the same rule files and that Hookify should be disabled — AC-1.5

## Quality Gates

- README.md and CHANGELOG.md exist; CHANGELOG lists every deliberate difference
- Toggle never overwrites a file edited since it was read

Sources: `.start/specs/001-rule-enforcement/requirements.md`, `solution.md` (components, Runtime, Rule format).
