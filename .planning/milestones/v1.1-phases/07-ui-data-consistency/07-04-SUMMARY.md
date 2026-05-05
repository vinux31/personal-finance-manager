---
plan: 07-04
phase: 07-ui-data-consistency
status: complete
type: execute
wave: 3
completed: 2026-04-29
key-files:
  created:
    - .planning/phases/07-ui-data-consistency/07-04-DEPLOY-LOG.md
---

# Plan 07-04 Summary — Phase 7 DB Deploy (Wave 3)

## What Was Built

Live Supabase Cloud DB updated with 3 Phase 7 migrations via Studio SQL Editor:

| Migration | Object | Result |
|-----------|--------|--------|
| 0022 | `user_seed_markers` table + `seed_rencana(UUID)` RPC + `reset_rencana_marker()` RPC | Applied ✓ |
| 0023 | `goals_with_progress` VIEW (`security_invoker=true`) | Applied ✓ |
| 0024 | `add_money_to_goal` v2 (cash+investment-aware) + `withdraw_from_goal` MESSAGE patch + status backfill | Applied ✓ |

## Key Metrics

- **candidates_before** (goals eligible for backfill): 1 (goal id=1 "Dana Pernikahan", fully investment-funded)
- **candidates_after** (still active after backfill): 0 — all eligible rows flipped
- **overload_count** (add_money_to_goal functions): 1 — DROP FUNCTION v1 confirmed, no ghost overload
- **marker_rows** (user_seed_markers after backfill): 2 existing users covered
- **pgTAP total PASS**: 13 (5 + 3 + 5 structural proofs)
- **pgTAP total FAIL**: 0

## Demo Case Verified (SC#1)

Goal id=1 "Dana Pernikahan":
- target_amount: Rp 100,000,000
- total_amount: Rp 100,000,000 (entirely from linked investment, current_amount = 0)
- status: **completed** (flipped by 0024 backfill — visible immediately, no user action required)

## Deviations / Notes

- **Studio RAISE NOTICE limitation**: Supabase Studio SQL Editor does not display RAISE NOTICE output. pgTAP tests were adapted to UNION ALL SELECT format for Results tab visibility.
- **Behavioral SKIP**: Scenarios 1-7 per test file skipped because Studio blocks auth.users INSERT in cloud. Accepted per plan acceptance criteria — structural proofs (Section 1) sufficient.
- **candidates_before operator error**: Pre-paste capture accidentally omitted; value reconstructed = 1 from 0023 Task 3 Query 3 output. Does not affect deploy correctness.
- **Migration history**: Cloud DB now at 0024. `supabase migration list --linked` continues to show 0014..0024 as Local-only — accepted per STATE.md decision.

## Threats Addressed

| Threat | Status |
|--------|--------|
| T-07-15 Tampering (paste integrity) | Mitigated — pre-flight grep checks + post-paste verification queries |
| T-07-16 Tampering (partial apply) | Mitigated — each migration idempotent, Tasks 2-4 gates verified |
| T-07-17 Info Disclosure (deploy log secrets) | Mitigated — log contains only schema metadata, no user PII |
| T-07-18 DoS (live DB during paste) | Accepted — backfill touched 1 row, no contention |

## Wave 4 Unblocked

Plans 07-05, 07-06, 07-07 can now proceed:
- `goals_with_progress` VIEW available for frontend query switch (07-05)
- `seed_rencana(UUID)` RPC available for `useRencanaInit` refactor (07-05)
- `add_money_to_goal` v2 live — SC#1 demo case already visible in DB (07-08 UAT)

Full audit trail: `.planning/phases/07-ui-data-consistency/07-04-DEPLOY-LOG.md`
