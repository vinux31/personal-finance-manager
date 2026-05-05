---
plan: 09-03
phase: 09-phase-09-qa-bug-fix-fix-semua-bug-dari-qa-findings-md
status: complete
completed: 2026-05-01T12:16:38Z
type: human-action checkpoint
---

## Summary

Migration `0025_fix_goal_bugs.sql` berhasil di-apply ke production Supabase database via Studio SQL Editor pada 2026-05-01 19:16 WIB.

## What Was Done

Plan 09-01 sudah membuat file SQL idempotent di repo. Plan 09-03 mendeploy file tersebut ke production melalui manual paste ke Supabase Studio SQL Editor — de-facto migration channel project ini karena `supabase db push` broken (history mismatch).

## Verification Results

### Pre-paste (Step 3)
Confirmed 3 functions exist (prerequisite from Phases 5–8):
| proname | args |
|---------|------|
| add_money_to_goal | p_id bigint, p_amount numeric |
| enforce_goal_investment_total | (none) |
| withdraw_from_goal | p_id bigint, p_amount numeric |

### Studio Paste (Step 4)
Result: **Success. No rows returned** — no SQL errors.

### Post-paste Verification (Step 5)

**Critical #1 — enforce_goal_investment_total (FOR UPDATE+aggregate fix):**
| critical_1_subquery_pattern | critical_1_for_update_in_subquery |
|-----------------------------|-----------------------------------|
| PASS | PASS |

**Critical #2 — add_money_to_goal (ambiguous column fix):**
| critical_2_alias_in_select | critical_2_alias_in_where |
|----------------------------|---------------------------|
| PASS | PASS |

**GRANT EXECUTE:**
| grantee | privilege_type |
|---------|----------------|
| authenticated | EXECUTE |

### Smoke Test (Step 6)
- **Link Investasi (Critical #1):** "alokasi berhasil disimpan" — sukses tanpa error `FOR UPDATE is not allowed with aggregate functions` ✓
- **Tambah Uang (Critical #2):** Fungsi `add_money_to_goal` now callable without `column reference "current_amount" is ambiguous` error ✓

## Outcome

- Critical #1 (`enforce_goal_investment_total`) — **RESOLVED** at production runtime
- Critical #2 (`add_money_to_goal`) — **RESOLVED** at production runtime
- Trigger `goal_investments_total_check` — intact on `goal_investments`
- GRANT EXECUTE — applied to `authenticated` role

## Self-Check: PASSED
