# Specification: 001-rule-enforcement

## Status

| Field | Value |
|-------|-------|
| **Created** | 2026-10-10 |
| **Current Phase** | Complete |
| **Last Updated** | 2026-10-11 |

## Documents

| Document | Status | Notes |
|----------|--------|-------|
| requirements.md | completed | WHY — v2.0 (local-only v1) approved 2026-10-11 |
| solution.md | completed | WHAT (design) — v2.1 approved 2026-10-12 after seven review rounds; remaining advisories in review.md |
| plan.md | completed | Narrative plan + 10 slice tasks and 71 holdout scenario tasks in `.tracker/` (`task.js graph --spec 001`) |

**Status values**: `pending` | `in_progress` | `completed` | `skipped`

## Implementation

The specification describes the target state. `/implement` builds it by running each slice task in
`.tracker/` through a code→eval loop and records each slice's status on its task
(`task.js graph --spec 001`).

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
| 2026-10-12 | Spec finalized (readiness MEDIUM). Code repository location: `~/Code/personal/cc-enforcer`; spec left uncommitted (git skipped) | User decision |
| 2026-10-12 | Spec folder moved from the-startup into `~/Code/personal/cc-enforcer/.start/specs/001-rule-enforcement/`; implementation starts from that repository | User decision |
| 2026-10-12 | Spec renumbered 017 → 001 (`.start/specs/001-rule-enforcement/`), the first feature of the cc-enforcer repository | User decision |

## Assumption Ledger

Maintained by the specify skill's Clarify Intent phase. Standing entries appear as `[ASSUMPTION]` markers in the documents.

| Topic | Default | Impact if wrong | Status |
|-------|---------|-----------------|--------|
| Spec scope | v1 is the local Mods plugin only (project + personal rules); step 2 (service) is deferred to a later spec (2026-10-11) | — | Corrected |
| Code location | New standalone repository at `~/Code/personal/cc-enforcer` with its own marketplace; the spec lives in that repository's `.start/specs/` (moved from the-startup, 2026-10-12) | — | Confirmed |
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

## Context

Two-step product that keeps Claude Code's output aligned with a project's patterns, naming conventions and quality gates. Step 1 (this spec): a Claude Code Mods plugin that checks Claude's work against convention rules kept as files in the repository — strict rules stop a non-conforming change before it is made, guidance rules flag deviations afterwards so Claude corrects them; pattern rules are matched directly, plain-language rules are judged by a model; the main session and subagents are covered. Step 2: a TypeScript service where users sign in so their rule sets follow them across devices and can be shared with their organization or publicly.

---
*This file is managed by the specify-meta skill.*
