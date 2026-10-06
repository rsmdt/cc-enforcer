---
title: "001-rule-enforcement — Specification Report"
status: "complete"
readiness: "MEDIUM"
---

# Specification Report

> [!NOTE]
> Written by the specify skill at Finalize. This is the editor-readable record of *how* the
> specification was clarified: the ledger, research dispositions, document status, and decisions.
> The documents themselves (`requirements.md`, `solution.md`, `plan.md`) remain canonical —
> nothing here duplicates their content.

## Readiness

| Field | Value |
|-------|-------|
| Readiness | MEDIUM |
| Phase | Complete (ready for `/implement`) |
| Last updated | 2026-10-12 |

> [!IMPORTANT]
> **Readiness capped:** an architecture-shaping assumption is Standing — trusting the working directory
> is taken to cover project rules in `.claude/` folders up to the git root (research R4 could not show how
> far Claude Code's trust reaches). Four solution open questions are left to the slices that first need
> them (failed `classify` shape, owner-only log writes, Stop input / ranged read, Hookify's handling of
> `ask` and `llm_evaluate`).

## Clarification Ledger

### Unknowns

| Question | Stake — what it changes | Route | Criticality | Resolution |
|----------|-------------------------|-------|-------------|------------|
| What is v1's scope? | Whether a service, accounts and sharing are built | User | Blocking | Local only; rules are Hookify's files enforced through Mods (2026-10-11) |
| How is a model-judged condition told apart from a pattern? | Rule format and compatibility | User | Blocking | Operator `llm_evaluate`; the six Hookify operators are matchers |
| Can Mods keep a turn going and intercept a prompt? | Whether FR-21 is buildable | Research | Blocking | Yes (R1) |
| How does Hookify actually behave? | The compatibility target | Research | Shaping | Documented format plus listed deliberate differences (R2) |
| How do evaluator findings reach Claude? | Autonomy and injection risk | User + Research | Shaping | Shown to the user, who sends them; no automatic turns (R3) |
| How are hostile project patterns handled? | Session-wide mod shutdown risk | User + Research | Shaping | Claude Code's trust prompt gates project rules (R4, ADR-7) |
| Can a mod list folders and read file size? | Rule discovery | Research | Blocking | Yes, `$.fs.list` and `$.fs.stat` (R4) |
| Does trust cover parent folders up to the git root? | Which project rules apply | Research | Shaping | `open` — Standing assumption |

### Assumptions

| Topic | Default (otherwise assumed) | Impact if wrong | Status |
|-------|-----------------------------|-----------------|--------|
| Spec scope | v1 is the local Mods plugin only (project + personal rules); step 2 (service) is deferred to a later spec (2026-10-11) | — | Corrected |
| Code location | New standalone repository at `~/Code/personal/cc-enforcer`; the spec lives in that repository's `.start/specs/` | — | Confirmed |
| Meaning of "not so static" | Hot reload and a drafting command; layered sources and the rule repository dropped in the v1 re-scope (2026-10-11) | — | Corrected |
| Enforcement design | Gate lane: hard pattern rules inline and hard NL rules via a fast classifier behind a cheap prefilter, before the call runs, failing closed. Review lane: soft pattern rules after the call; soft NL rules batched to an in-mod auditor at each agent's turn end and on a timer, findings fed back to the main loop. A spawned auditor subagent only for rules marked deep | — | Confirmed |
| Failure behavior | Hard rules fail closed (block when the enforcer errors or times out); soft rules fail open | Fail-open hard rules can be silently bypassed; fail-closed can block work during outages | Standing |
| Who it serves | Step 1: a developer or a team sharing a repo, no accounts. Step 2: individual users and organizations with multiple members | — | Corrected |
| Rule authoring | Hand-written rule files plus a command that drafts a rule from the conversation | — | Confirmed |
| Rule file format | Hookify's own files, `.claude/hookify.*.local.md`, with Hookify's frontmatter plus action `ask` and operator `llm_evaluate` (2026-10-11) | — | Corrected |
| Implementation language | TypeScript mod module | — | Standing |
| Soft-rule reporting | Flags appear as a terminal toast/status and in a per-session log file; Claude is told on the next turn | Silent flags are easy to miss; telling Claude may change its behavior | Standing |
| Coverage | Main session and subagents; Workflow-spawned agents covered if Claude Code fires mod events for them | Missing coverage leaves a bypass path | Standing |
| Headless runs | In `claude -p` runs, rules that would ask the user are treated as blocks | Asking is impossible headless; allowing would bypass the rule | Standing |
| Step 2 offering | Multi-tenant SaaS first; self-hosting a later requirement | — | Deferred with step 2 (2026-10-11) |
| Step 2 login | OAuth (GitHub, Google) at launch; SAML/OIDC SSO for organizations later | — | Deferred with step 2 (2026-10-11) |
| Step 2 sharing scopes | Personal (all of a user's devices), org-wide (all members of an org), public. Team sharing is deferred; org-wide covers multi-user orgs | — | Deferred with step 2 (2026-10-11) |
| Org-wide rule control | Permissive: every user can enable or disable any rule, including rules provided by their org; a rule is enforced only while active; no tamper resistance | — | Deferred with step 2 (2026-10-11) |
| Severities | `block` (hard, before the call), `ask` (prompt the user; block in headless runs), `warn` (soft, after the call) | — | Confirmed |
| Soft-rule feedback | Matcher findings attach to the tool result (Claude reads them immediately); evaluator findings are shown to the user at turn end, who can send them to Claude; no automatic turns (2026-10-11) | — | Corrected |
| Device login | The plugin signs in to the service with a device-code login (RFC 8628); where the token is stored is an open solution risk | Storage may need an undocumented keychain path | Deferred with step 2 (2026-10-11) |
| Workflow-agent coverage | Tool calls from agents the Workflow tool starts are enforced, but the enforcer cannot attribute them to a named agent | Reports for those calls name no agent | Standing |
| Judging location | Rules are judged on the user's machine; the service only stores and syncs rules and never receives tool-call content | Server-side judging would make the service a processor of code and commands | Deferred with step 2 (2026-10-11) |
| Offline service | When the service is unreachable, the plugin keeps enforcing the last synced rules | Without a cache, an outage disables enforcement | Deferred with step 2 (2026-10-11) |
| Trust scope | Trusting the working directory covers project rules in `.claude/` folders up to the git root | Rules from an untrusted parent folder would apply | Standing |
| Working name | `cc-enforcer` for the repo and plugin | — | Corrected |
| Field limits | Fields matched on the first 32 KB (transcript: last 32 KB); 4 KB evaluated | A match beyond the limit is missed | Standing |
| Review cap | At most 50 calls per agent turn reviewed by evaluator `warn` rules | Calls beyond the cap are reported, not reviewed | Standing |
| `all`-event rules | `ask` applies to tool calls only; evaluator `all` rules skip stop | Unexpected skips at stop or prompt | Standing |

## Research Findings

| Perspective | Claim | Evidence | Disposition |
|-------------|-------|----------|-------------|
| Technical | F1: A mod's `tool.call` hook fires before any tool runs — including subagent and MCP calls — and returning `{ deny: reason }` without calling `next` stops it; | mods/events#guard-or-change-a-tool-call; d.ts:9789-9797 | Confirmed |
| Technical, Security | F2: Mod hooks fail open: a hook that throws or times out before `next` is skipped. | mods/events#handle-a-hook-that-fails; reference#limits; troubleshoot; api#send-one-prompt | Confirmed |
| Technical, Security | F3: After `await next(e)`, a `tool.call` hook can return `context` that Claude reads right after the tool result (the user never sees it). | d.ts:9849-9866; api#start-a-turn-from-a-background-job | Confirmed |
| Technical | F4: `$.model.complete/classify/fork` make no tool calls, so an in-mod judge cannot re-trigger `tool.call`. | d.ts:2236-2252, 10300-10302, 10457-10459, 140-144 | Confirmed |
| Technical | F5: Agents started by the Workflow tool carry an `agentId` that `$.agent.list()` cannot name, and whether `agent.spawn` fires for them is undocumented. | d.ts:168-169; reference#subagents | Deferred → Standing assumption |
| Technical | F6: There is no `$.fs.watch`; | reference#mods-api-methods; d.ts:2731-2784 | Confirmed |
| Technical | F7: `$.process.run` can run `git` (no shell, 30 s default / 10 min max, repo hooks off, outside the Bash sandbox; | api#reach-files-processes-and-the-network; d.ts:2957-2971, 3544 | Confirmed |
| Technical | F8: A plugin can ship skills alongside its mod, so the drafting command can be a skill (`/cc-enforcer:draft`). | overview#compare-mods…; api#add-a-command; reference#limits | Confirmed |
| `warn`), `enabled`, `tools`, `paths`, `match`, body | F9: Prior-art rule fields recur: id/name, natural-language description, severity, enabled flag, tool matcher, path globs, content conditions (`{field, op, pattern}`), and a body with the agent-facing reason. | `ask` \ | Hookify config_loader.py:33-42; Cursor, Copilot, Continue, Kiro docs; Claude Code permissions; AgentCore |
| Requirements/UX, Security | F10: Claude Code trusts restrictive rules from a repository but not permissive ones (project allow rules wait for workspace trust; | permissions#project-allow-rules-and-workspace-trust; auto-mode-config; cursor.com/docs/agent/hooks; ccsafetynet.com | Confirmed |
| Security | F11: A member can turn off any user-installed mod: disable the plugin, `--safe-mode`, or `disableAllHooks`; | mods/overview; mods/admin; hooks#block-the-action-when-a-hook-fails | Corrected — no tamper resistance: every user can enable or disable any rule, including org-provided ones; a rule is enforced only while active |
| Security, Technical | F12: Prompt injection cannot be fully prevented (OWASP LLM01). | genai.owasp.org LLM01; mods/api#call-a-model; d.ts:1093-1098, 2264-2281 | Confirmed |
| Security | F13: Judging with `$.model.*` sends the rule and tool input to the model provider under the user's own plan and terms. | mods/api#call-a-model; data-usage; gdpr-info.eu Art. 5, 28 | Confirmed |
| Security, Integration | F14: A mod can run an OAuth device flow with `$.http` and `$.ui`; | RFC 8628 §5.1, 5.4, 5.6; docs.github.com device flow; Google limited-input-device; plugins-reference#user-configuration; d.ts:6182-6193 | Corrected — device-code login (RFC 8628) at launch; token storage path is an open risk for the solution |
| Integration | F15: `$.http.fetch` has no timeout or abort option (2.1.277), and API wait time does not count against the 10 s hook limit — a per-call fetch could hold a tool call. | d.ts HttpInit; reference#limits; interface#keep-state; server-managed-settings | Confirmed |
| Security | F16: Public sharing needs abuse controls seen in comparable registries: verified publishers, versions pinned by content hash, a preview of what a rule set blocks before adopting it, and never applying an update that loosens r | plugins/security; VS Code verified publishers; npm provenance; OWASP LLM03 | Confirmed |
| Integration | F17: Auth stack options: Better Auth (TypeScript; | better-auth.com docs; authjs.dev; workos.com docs and pricing | Deferred to Solution |
| Requirements/UX | F18: "rulebook" collides with cc-safety-net, which already calls its shareable rule packs "rulebooks" | ccsafetynet.com/docs/configuration/rulebooks | Discarded — working title is cc-enforcer |
| Technical | F19: Mods need Claude Code v2.1.287+ (terminal) / v2.1.286+ (Desktop); | mods/overview#turn-mods-on-or-off; api#use-prompt-caching; create#get-the-types-for-your-build | Confirmed |
| Requirements/UX | F20: Pattern matching on Bash text is fragile (flag reordering, wrappers, compound commands, `sh -c`); | permissions#what-a-bash-rule-doesnt-match; issues #30519, #39459; longline README | Confirmed |
| Requirements/UX | F21: Demand: users report CLAUDE.md rules followed "maybe 60-70%" and hooks as the only reliable safeguard; | anthropics/claude-code#32163, #47594, #65961; claude-plugins-official#5707, #6339, #4091, #6314; Hookify rule_engine.py:72-91 | Confirmed |
| Technical | R1: Mods (2026-10-11): `classic.Stop`/`classic.SubagentStop` returning `{ block: reason }` keeps Claude working and gives it `reason` (check `stop_hook_active` against loops); | types.d.ts (2.1.277) 976-983, 1071, 1086-1088, 2114-2128, 3364-3371, 4219-4236, 7188-7260, 9448-9462, 10278-10353; mods/events.md:174-240; reference.md:282; hoo | Confirmed |
| Technical | R2: Hookify (2026-10-11, source read and executed): reads `.claude/hookify.*.local.md` relative to the hook's cwd only; | hookify core/config_loader.py, core/rule_engine.py, hooks/*.py (all 16 cached versions identical) | Confirmed |
| Technical | R3: On-screen notices (2026-10-11): `$.ui.log`, `$.ui.toast` and `$.ui.status` reach the user only, never Claude. | cc-plugin-you-should-know mod source; mods types `ui.render`, `prompt.fill`, `session.surfaces` | Confirmed |
| Technical | R4: Mods files and trust (2026-10-12, types 2.1.277 + live docs): `$.fs.list(path?)` returns `{name, kind, size, isLink}` per entry, not recursive; | types.d.ts 2778-2784, 4085-4106, 2791-2842, 4148-4178, 9396-9411; mods/reference.md#mods-api-methods; mods/admin.md#know-which-controls-still-apply; mods/create | Confirmed |

## Documents

| Document | Status | Notes |
|----------|--------|-------|
| requirements.md | completed | v2.0, local-only v1; approved 2026-10-11; `[ASSUMPTION]` lines added for field limits, review cap and `all`-event rules |
| solution.md | completed | v2.1, approved 2026-10-12 after seven review rounds; remaining advisory findings in `review.md` |
| plan.md | completed | 10 slice tasks, 71 holdout scenarios in `.tracker/` (`task.js graph --spec 001`) |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-10 | Spec scaffolded from the /start:analyze research on Claude Code Mods and hooks | Research findings in this session ground the brief |
| 2026-10-10 | One spec for both steps; plugin code in a new standalone repository | User choice in Clarify Intent |
| 2026-10-10 | Gate/review lane enforcement design; step 2 is SaaS-first with OAuth, sharing scopes personal/org-wide/public | User choice in Clarify Intent round 2 |
| 2026-10-10 | Research findings dispositioned (research-findings.md): org rules are permissive and user-toggleable; device-code login; severities block/ask/warn | User disposition of research |
| 2026-10-10 | Start with Requirements; Standard research mode | User choice |
| 2026-10-10 | Requirements approved; working title cc-enforcer | User approval |
| 2026-10-11 | ADR-1..4 confirmed (monorepo; classify inline / complete batched; Next.js + Better Auth + Postgres; OS keychain with file fallback). ADR-5: rules live in their own `.enforcer/` directory | User decision in the solution phase |
| 2026-10-11 | Solution review (0/8): AC-9.3 relies on Claude Code's own signals (transcript notice, `/plugin` mods active, `/reload-plugins`); same-id rules match per copy and only local sources share ids | User decision on review findings |
| 2026-10-11 | Re-scope v1 to local only: no service, accounts, sharing or rule repository; step 2 removed from this spec and kept as one "Later" line in the PRD | User decision |
| 2026-10-11 | Rules are Hookify's own files (`.claude/hookify.*.local.md`, same frontmatter), enforced through Claude Code Mods instead of hooks; cc-enforcer replaces the Hookify plugin and tells the user once to disable it if still enabled. Supersedes ADR-5 (`.enforcer/`) | User decision |
| 2026-10-11 | Condition kinds: the six Hookify operators are matchers (deterministic); a new operator `llm_evaluate` makes a condition an evaluator (model-judged, `pattern` holds the question). Matcher conditions run first as a prefilter; the model sees only the evaluator's `field`. No new top-level field | User decision |
| 2026-10-11 | Actions `block`, `ask`, `warn`; all Hookify events (bash, file, stop, prompt, all); v1 keeps live reload, overview + on/off, drafting command. Hookify import dropped (files are read directly) | User decision |
| 2026-10-11 | Plain rule `name` is the only identity; same-name copies merge (strictest matching action wins) and share one on/off switch | User decision |
| 2026-10-11 | Rule sources: project `.claude/` and personal `~/.claude/`; dry run dropped (FR-18 retired); stop/prompt use Hookify semantics, `ask` invalid there | User decision |
| 2026-10-11 | Requirements v2.0 approved: `llm_evaluate` allowed on `prompt` (field `user_prompt`), invalid on `stop`; on/off writes the file's `enabled` field (AC-10.2 retired); `warn` on `stop` shows the user only; same-name copies keep separate `enabled` fields (supersedes the shared on/off switch above); mods support for stop/prompt interception is an open question for the solution | User approval of defaults |
| 2026-10-11 | Research R1 (mods events) and R2 (Hookify behaviour) confirmed. Compatibility target = Hookify's documented format plus listed deliberate differences (AC-1.4, NFR-17 reworded). Regex: JavaScript RegExp, case-insensitive, translating common Python-only forms, rejecting the rest. One plugin package (ADR-1 revised; ADR-3, ADR-4 retired with the service) | User decision in the solution phase |
| 2026-10-11 | Solution review (0/8) fixes: one Check unit owns select → evaluate → `Rules.resolve()` (combining matching rules, fail-closed mapping, backstop); the project root stops at the git root and never resolves to `~/.claude`; ADR-7 revised to reject risky project regexes at load and cap fields at 32 KB; toggle takes an optional source and changes nothing on an ambiguous name | User decision on review findings |
| 2026-10-11 | Research R3 confirmed. Evaluator `warn` findings are shown to the user (log plus the band above the prompt with "Send to Claude" / "Dismiss") and reach Claude only when the user sends them; no automatic turns, no mid-turn timer. AC-8.2 reworded. Stop loop guard and stop fail-open kept; prompt block fails closed. 30-day log deletion dropped | User decision |
| 2026-10-12 | Research R4 confirmed. Project rules rely on Claude Code's trust prompt (no mod loads in an untrusted folder); no regex rejection; project messages labelled with their source. ADR-7 revised again. Rules gain ids (`<source>:<name>`); Rules is the sole owner of field extraction; `all` + `ask` / `all` + evaluator skip rules added to the PRD as assumptions under FR-6 and FR-7 | User decision on the second solution review |
| 2026-10-12 | Solution v2.1 approved: round-7 blocking findings fixed (in-flight record kept on a rejected `next`; project folder re-chosen on every load), review loop stopped with advisories noted in review.md. Git-root search kept (trusting the working directory covers rules up to the git root, Standing assumption). PRD field limits (32 KB / 4 KB) and the 50-call review cap kept | User decision |
| 2026-10-12 | Plan approved: 10 vertical slices (block rules first; 2, 3, 4, 5, 7, 9, 10 parallel after it; 6 after 4+5; 8 after 5), 71 scenarios; ~30 AC-restating EARS proven by business scenarios only (accepted) | User approval |

## Next Steps

- [ ] `/start:implement 001` — slice 1 first; slices 2, 3, 4, 5, 7, 9, 10 then run in parallel
- [ ] Resolve each solution open question inside the slice that owns it
