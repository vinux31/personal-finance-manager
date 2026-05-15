# Plan 16-01 Summary — Pre-condition Setup & Migration Playbook

**Status:** COMPLETE
**Date:** 2026-05-15

## What Was Done
- Pre-condition data B1-B4 setup via Supabase Studio SQL Editor (user 546627bd)
- TECHDEBT-01: docs/migration-playbook.md created (6 sections)
- PROJECT.md Key Decisions updated dengan migration reconciliation entry

## Pre-condition State
- B1: template_id=7 — income monthly (Gaji existing), next_due_date=2026-05-01
- B2: template_id=8 — expense template (Tagihan Internet created), next_due_date=2026-05-01
- B3: goal_id=29 — active goal "UAT B3 Test Goal", current_amount=Rp100,000
- B4: goal_id=30 — completed goal "UAT B4 Completed Goal", current_amount=Rp10,000 (= target)
- B5: No data setup needed

## Artifacts
- docs/migration-playbook.md — created (commit add8b1e)
- .planning/PROJECT.md — Key Decisions table updated (commit add8b1e)

## Notes
- categories table tidak punya user_id (shared/global table) — SQL di plan perlu fix ini jika dipakai ulang
- recurring_templates.id adalah BIGSERIAL bukan UUID — declare v_template_id BIGINT bukan UUID
- Goal IDs untuk Plan 16-02 UAT: B3=goal_id 29, B4=goal_id 30
