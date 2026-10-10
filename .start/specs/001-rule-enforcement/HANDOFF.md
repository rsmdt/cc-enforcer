# Handoff — spec 001 (cc-enforcer)

Written 2026-10-11 to continue this specification in a fresh session.

## What cc-enforcer is

A Claude Code plugin, plus a later web service, that keeps the code Claude produces aligned with a
project's own patterns, naming conventions and quality gates. Teams write their conventions as rule
files; the plugin checks Claude's work against them as it happens. Strict rules stop a change that does
not follow a convention and name the conforming alternative; guidance rules let the change through and
tell Claude what to fix. The user decides which rules are on. Step 2 adds an account so rule sets follow
the user across devices and can be shared with an organization or publicly.

## Where things stand

| Phase | Status | File |
|-------|--------|------|
| Clarify intent + research | Done; every finding dispositioned | `README.md` (ledger, decisions), `research-findings.md` |
| Requirements | Approved | `requirements.md` |
| Solution design | Drafted; two review rounds; second-round fixes **partly applied** | `solution.md`, `review.md` |
| Plan | Not started | — |

All decisions so far are logged in `README.md` (Decisions Log and Assumption Ledger). The five
architecture decisions are confirmed in `solution.md` → Decisions (ADR-1 … ADR-5).

## Remaining work on `solution.md`

`review.md` holds the second review round in full; each finding names its location and a suggested
fix. These items from it are **not yet applied** — apply them, keeping the rest of the document as is:

**Schema (Interfaces & data → Schema changes)**
- [ ] `rule_set`: make `kind` the single discriminator and remove the overlap between `owner_org_id`,
      `shared_with_org_id` and `visibility` (sharing a personal set with an org can record the
      publishing user separately).
- [ ] Define what happens to rule sets when a publisher deletes their account, consistent with
      "Publisher deletion" (existing adopters keep the versions) and with the one-owner rule.
- [ ] Add where sign-in attempt limits are kept (a table or a shared store), working across instances.
- [ ] Drop `rule_set_version.schema_version` (the version is inside `rules`) or mark it derived.

**Runtime**
- [ ] Align the "Before a tool call runs" diagram, step 3, step 5 and the NFR-3 row with the decided
      path: the Judge returns conforms / does not conform / no verdict; the Gate alone turns no verdict,
      an error or a timeout into "check failed", which always stops the call; `.catch` is only a backstop.
- [ ] Batch review: keep only reply items whose rule and tool call were in that batch, cap the finding
      text, and deliver findings in a fixed template that quotes them as review output.
- [ ] Note that the rule-repository sync needs the terminal; elsewhere it reports once that the
      repository is unavailable and lists that in the overview. Add it to Risks.
- [ ] Multi-component → Contracts: replace the `409` wording with the per-set `unsupported` status
      already used in the Interfaces table.

**Behavior (EARS)**
- [ ] AC-7.3: "WHEN inspected content contains instructions addressed to the judge, THE SYSTEM SHALL
      reach the verdict on the rule alone" — for both the pre-call verdict and the batch review.
- [ ] AC-15.3: limit to org-wide rules; put the org-shared-set clause under AC-16.1 if kept.
- [ ] AC-17.2: add "WHEN the adopter accepts the new version, THE SYSTEM SHALL move their pin and apply
      it from the next sync" (accepted in the web app).
- [ ] AC-19.2: "IF a rule set's name matches a verified publisher's but its owner differs, THEN no
      verified mark"; the mark depends on the actual owner's verification.

**Open questions**
- [ ] Add: does waiting for the user's answer to an `ask` prompt count against the 10 s hook budget?
      Default: confirm against the installed build's generated types before building FR-6.

Already applied from the second round (no action): FR-14 ownership split, the single verdict owner in
the component table, schemaVersion conversion owned by the rule engine, per-set `unsupported` in the
Interfaces table, ETag after access checks, `device_expired`, user-scope-only service and repository
settings, separate local/service rule identities, new interface rows, log without command text,
snapshot-based repository updates, unsupported `warn` rules reported.

## Then

1. Re-run the solution review (step 5 of the specify-solution skill) and present the grade.
2. Fix with the user until no review dimension fails (or the user accepts the remaining findings).
3. Mark `solution.md` approved in `README.md`, then continue to the Plan phase (specify-plan skill).

## Unrelated follow-up (the-startup repo)

The `specify-requirements` skill and the `specify` skill's research step should offer a dynamic-workflow
research option (parallel researchers whose claims are checked by independent verifiers, like the
`analyze` skill), alongside Standard and Agent Team.

## Prompt for the new session

```
/start:specify 001
Continue spec 001 (cc-enforcer) from .start/specs/001-rule-enforcement/HANDOFF.md.
Read HANDOFF.md, README.md, requirements.md, solution.md and review.md, apply the unchecked items
under "Remaining work on solution.md" in small edits, then re-run the solution review.
```
