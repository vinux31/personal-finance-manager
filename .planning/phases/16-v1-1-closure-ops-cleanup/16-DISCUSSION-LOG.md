# Phase 16: v1.1 Closure & Ops Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 16-v1-1-closure-ops-cleanup
**Areas discussed:** TECHDEBT-01 Strategy, Pre-condition Data Setup, Plan Structure, New Migrations, UAT Method
**Mode:** `--auto` (all areas auto-selected, recommended options chosen without user interaction)

---

## TECHDEBT-01 Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Path (a): Repair history | Run `supabase migration repair` + `supabase db push` to restore CLI push workflow | |
| Path (b): Document procedural alternative | Studio paste stays default; add dummy applied entries; write future-migration playbook | ✓ |

**Auto-selected:** Path (b) — document procedural alternative
**Reasoning:** Prior decisions lock Studio paste as de-facto channel; memory note "jangan repair tanpa diagnosis"; path (a) risky without full diagnosis of drift extent; success criteria TECHDEBT-01 satisfied by either path, path (b) lower blast radius.

---

## Pre-condition Data Setup Method

| Option | Description | Selected |
|--------|-------------|----------|
| SQL Editor (Studio) | Batch SQL INSERT/UPDATE via Supabase Studio SQL Editor | ✓ |
| Manual UI | Navigate app UI to create required data state | |
| Mix | SQL for state setup, UI for verification steps | (subsumed by SQL Editor selection) |

**Auto-selected:** SQL Editor — reproducible, idempotent, explicit state control.

---

## Plan Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single plan | All of B1-B5 + TECHDEBT-01 in one plan | |
| Two plans | 16-01 (setup + TECHDEBT) + 16-02 (UAT execution) | ✓ |

**Auto-selected:** Two plans — clean separation; 16-01 can be done async, 16-02 requires interactive browser session.

---

## New Migrations Needed?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Phase 16 requires new SQL migrations | |
| No | All code shipped in prior phases; Phase 16 is verification only | ✓ |

**Auto-selected:** No — confirmed via migration history audit. 0019 (process_due_recurring), 0020 (withdraw_from_goal), 0022 (todayISO), Phase 10 CORS unblock all cover B1-B5 requirements.

---

## UAT Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright automated | Write Playwright specs for B1-B5 | |
| Manual browser + SQL | Manual click flow + SQL post-condition checks | ✓ |
| SQL only | Pure database assertion without UI verification | |

**Auto-selected:** Manual browser + SQL — race condition scenarios (B2, B3) not reliably automatable with Playwright in production; B5 requires DevTools network inspection.

---

## Claude's Discretion

- Playbook format (inline PROJECT.md vs separate doc) — decide based on content length
- SQL pre-condition script content — derive from existing schema
- B1-B5 execution order in 16-02 — sequence from simplest to most complex

## Deferred Ideas

- View-As UAT Phase 13/14 VERIFICATION.md items — needs admin seed cycle
- goals_with_progress VIEW v2 (add created_at) — v1.3 backlog
- recurring_runs rename — PROJECT.md backlog
