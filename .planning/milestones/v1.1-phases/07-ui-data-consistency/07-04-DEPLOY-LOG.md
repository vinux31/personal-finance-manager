# Phase 7 Deploy Log — Wave 3

**Date:** 2026-04-29
**Channel:** Supabase Studio SQL Editor (per project STATE.md decision; `db push` broken — history mismatch since migration 0014)
**Commits applied:** 0022 → 0023 → 0024
**Deployed by:** Claude executor + human paste (Rino)

## Pre-flight (Task 1)

All 6 migration/test files confirmed present and grep-verified before paste:

```
-rw-r--r-- supabase/migrations/0022_user_seed_markers.sql     (6002 bytes)
-rw-r--r-- supabase/migrations/0023_goals_with_progress.sql   (1235 bytes)
-rw-r--r-- supabase/migrations/0024_add_money_to_goal_v2.sql  (7093 bytes)
-rw-r--r-- supabase/tests/07-seed-rencana.sql                 (9763 bytes)
-rw-r--r-- supabase/tests/07-goals-with-progress.sql          (6249 bytes)
-rw-r--r-- supabase/tests/07-add-money-v2.sql                 (8843 bytes)
```

Grep checks:
- 0022 SECURITY DEFINER count: 2 ✓
- 0023 security_invoker count: 1 ✓
- 0024 DROP FUNCTION count: 1 ✓ (D-13 terpenuhi)
- 0024 withdraw MESSAGE: 1 ✓ (D-14 terpenuhi)

Wave 1+2 commits on master:
- 8a704f6 docs(phase-07): update tracking after wave 2
- 90c49e6 docs(07-03): complete add_money_to_goal v2 plan summary
- 6484133 test(07-03): add pgTAP integration test for add_money_to_goal v2
- c2a29b2 feat(07-03): create migration 0024 add_money_to_goal v2 + backfill + withdraw MSG patch
- aafc56f docs(phase-07): update tracking after wave 1
- b37acc9 chore: merge executor worktree (07-02 user_seed_markers)

## 0022 verification (Task 2)

Migration `0022_user_seed_markers.sql` pasted and run via Studio SQL Editor — Success.

Query 1 — table existence:
| exists |
| ------ |
| true   |

Query 2 — RPC existence + SECURITY DEFINER + search_path:
| is_definer | has_search_path | reset_exists |
| ---------- | --------------- | ------------ |
| true       | true            | true         |

Query 3 — backfill effect:
| marker_rows |
| ----------- |
| 2           |

Query 4 — RLS policy:
| polname                        | using_clause                                   |
| ------------------------------ | ---------------------------------------------- |
| users manage own seed markers  | ((auth.uid() = user_id) OR is_admin())         |

## 0023 verification (Task 3)

Migration `0023_goals_with_progress.sql` pasted and run via Studio SQL Editor — Success.

Query 1 — VIEW existence:
| view_exists |
| ----------- |
| true        |

Query 2 — security_invoker:
| has_security_invoker |
| -------------------- |
| true                 |

Query 3 — candidates for backfill (active goals total_amount >= target_amount):
| id | user_id                              | current_amount | total_amount                                   | status |
| -- | ------------------------------------ | -------------- | ---------------------------------------------- | ------ |
| 1  | 546627bd-8441-4193-9263-d7388eac59b3 | 0.00           | 100000000.000000000000000000000000000000000000 | active |

Note: 1 candidate identified (goal id=1, entirely investment-funded). Will be backfilled to 'completed' by 0024.

Query 4 — GRANT check:
| authed_can_select |
| ----------------- |
| true              |

## 0024 verification (Task 4)

Migration `0024_add_money_to_goal_v2.sql` pasted and run via Studio SQL Editor — Success.

**Note:** Pre-paste `candidates_before` query was accidentally run after paste (operator error). Reconstructed from Task 3 Query 3: **candidates_before = 1** (goal id=1 "Dana Pernikahan").

**candidates_before:** 1 (reconstructed from 0023 Task 3 output)
**candidates_after:** 0
**overload_count:** 1

Query 1 — add_money v2 has FOR UPDATE + goal_investments + search_path:
| has_for_update | has_invest_subquery | has_search_path |
| -------------- | ------------------- | --------------- |
| true           | true                | true            |

Query 2 — withdraw MESSAGE patch:
| has_split_message |
| ----------------- |
| true              |

Query 3 — backfill effect (post UPDATE):
| candidates_after |
| ---------------- |
| 0                |

Query 4 — demo case verification (SC#1: target Rp 10jt + 60% × Rp 18jt = Rp 10.8jt):
| id | name            | target_amount | total_amount                                   | status    |
| -- | --------------- | ------------- | ---------------------------------------------- | --------- |
| 1  | Dana Pernikahan | 100000000.00  | 100000000.000000000000000000000000000000000000 | completed |

Query 5 — no v1 overload (DROP discipline check):
| overload_count |
| -------------- |
| 1              |

## pgTAP test runs (Task 5)

Note: Studio SQL Editor does not display RAISE NOTICE output. Tests were adapted to UNION ALL SELECT returning rows in Results tab. Behavioral scenarios (auth.users seeding) produce SKIP in cloud — expected per plan acceptance criteria.

### 07-seed-rencana.sql
| test_num | result                                 |
| -------- | -------------------------------------- |
| 1        | PASS: seed_rencana(UUID) exists        |
| 2        | PASS: reset_rencana_marker() exists    |
| 3        | PASS: seed_rencana has SET search_path |
| 4        | PASS: seed_rencana is SECURITY DEFINER |
| 5        | PASS: table user_seed_markers exists   |

PASS count: 5
FAIL count: 0
SKIP count: behavioral scenarios (Scenarios 1-7 — auth.users insert blocked in cloud, expected)

### 07-goals-with-progress.sql
| test_num | result                                          |
| -------- | ----------------------------------------------- |
| 1        | PASS: VIEW goals_with_progress exists           |
| 2        | PASS: VIEW uses COALESCE for NULL current_price |
| 3        | PASS: VIEW has security_invoker=true            |

PASS count: 3
FAIL count: 0
SKIP count: behavioral scenarios (auth.users insert blocked in cloud, expected)

### 07-add-money-v2.sql
| test_num | result                                                           |
| -------- | ---------------------------------------------------------------- |
| 1        | PASS: add_money_to_goal(BIGINT,NUMERIC) exists                   |
| 2        | PASS: add_money_to_goal v2 uses FOR UPDATE                       |
| 3        | PASS: add_money_to_goal v2 considers linked investments          |
| 4        | PASS: add_money_to_goal v2 has SET search_path                   |
| 5        | PASS: withdraw_from_goal MESSAGE includes split kas vs investasi |

PASS count: 5
FAIL count: 0
SKIP count: behavioral scenarios (auth.users insert blocked in cloud, expected)

## Verdict

PASS-WITH-NOTES — semua structural proofs PASS (13 total), zero FAIL lines.

**Notes:**
- Behavioral scenarios (Scenarios 1-7 per file) di-SKIP karena Supabase Cloud memblokir INSERT ke auth.users dari Studio SQL Editor — ini expected dan didokumentasikan di plan acceptance criteria
- Supabase Studio tidak menampilkan RAISE NOTICE output; tests diadaptasi ke UNION ALL SELECT format untuk Results tab
- Pre-paste `candidates_before` accidentally tidak di-capture (operator paste 0024 sebelum query); nilai direkonstruksi = 1 dari Task 3 Query 3 output
- Demo case verified: goal id=1 "Dana Pernikahan" (target Rp 100jt, fully investment-funded) → status = 'completed' post-backfill, visible tanpa user action
- Migration history: cloud DB now at 0024; `supabase migration list --linked` masih menampilkan 0014..0024 sebagai Local-only — accepted per STATE.md decision
- Wave 4 plans (07-05, 07-06, 07-07) unblocked
