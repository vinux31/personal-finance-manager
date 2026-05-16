# Phase 14: Protection & Tier 4 Checklists — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Source:** Design spec `docs/superpowers/specs/2026-05-08-framework-page-design.md` (commit `b219fc3`) §4 inline checklist + §4 smart-gated + §7 schema. Migration `supabase/migrations/0029_protection_checklist.sql` already shipped (Phase 12). Phase 13 CONTEXT.md establishes accordion pattern + IndikatorCard variants + View-As pattern (`useTargetUserId`).

<domain>
## Phase Boundary

**This phase delivers:**
- **DIAG-04**: Tier 1 #4 Asuransi Kesehatan inline form — radio 5 opsi (kantor/bpjs/pribadi/kombinasi/tidak) di IndikatorCard #4. Submit → upsert `protection_checklist.health_coverage` → indicator color flip optimistic (hijau bukan "tidak", merah "tidak").
- **DIAG-09**: Tier 4 smart-gated checklist — gate question "Punya tanggungan finansial?" + conditional reveal sections inline (estate universal + asuransi jiwa kalau has_dependents=true).
- **DIAG-12**: View-As read-only mode — admin viewing other user → form visible disabled + banner top "Mode View-As: read-only" + submit hidden.
- Tier 4 indicator color aggregation per spec §4: hijau semua "ya"/"kantor"/"BPJS" etc, merah ada "tidak"/"tidak ada", abu-abu kalau gate belum dijawab atau row belum exist.
- IndikatorCard variant baru `form-radio` (Tier 1 #4) — replace shell yang stub di Phase 13.
- Tier4Panel real implementation — replace placeholder text dari Phase 13 dengan checklist UI.

**This phase does NOT deliver:**
- Schema change apa pun — `protection_checklist` table sudah ada (migration 0029, Phase 12). Zero new column.
- 6 modul edukasi sub-route content — Phase 15.
- Kalkulator compound interest — Phase 15.
- Asset class normalization Tier 3 (DIAG-08 risk) — defer v1.3.

**Why this is now:** Phase 13 ship tier panel infrastructure + 8 indicators data-driven. Tier 1 #4 was a stub (`computeAsuransiShell` reads `health_coverage` if row exists, else "Belum diisi"). Tier 4 was placeholder text. Phase 14 inject mutation forms + wire Tier 4 color aggregation.

</domain>

<decisions>
## Implementation Decisions (Locked)

### A. Tier 1 #4 form layout: Inline replace IndikatorCard

**Decision:** Klik IndikatorCard #4 (saat variant `cta-fallback` "Belum diisi") → card flip jadi form radio inline (5 opsi sesuai schema enum). Submit → card flip kembali ke `compute` variant warna sesuai jawaban. Zero modal/drawer.

**Files:**
- `src/tabs/kesehatan/IndikatorCard.tsx` — extend dengan variant baru `form-radio` atau wrap with internal state `isEditing`
- `src/tabs/kesehatan/Tier1Panel.tsx` — pass `onEditAsuransi` handler atau biarkan IndikatorCard self-contained

**UX flow:**
1. Empty state (no row OR `health_coverage IS NULL`): card render "Belum diisi" red badge + button "Pilih cover →"
2. User klik button → card body switch ke radio group 5 opsi + button "Simpan"
3. Submit → optimistic UI (card flip ke compute variant warna baru) + background mutation → sukses confirm (toast "Tersimpan") atau rollback + toast error
4. Compute state (row exists): card render value (e.g., "BPJS" green badge) + small button edit icon → klik → kembali ke radio mode dengan value pre-selected

**Rationale:** Konsisten dengan accordion-style (zero pop-up). Match design spec §4 "inline checklist". Mobile-friendly tanpa install Drawer package.

### B. Tier 4 form layout: Gate first → conditional sections inline

**Decision:** Tier4Panel render single panel scroll dengan sections berurutan:

1. **Gate section** (top): "Punya tanggungan finansial (anak, pasangan, ortu)?" → 2 radio Ya/Tidak. Default unanswered.
2. **Asuransi Jiwa section** (conditional, render kalau `has_dependents = true`): 3 questions
   - `life_coverage` 4 opsi radio (kantor/pribadi/keduanya/tidak)
   - `life_coverage_sufficient` 2 radio (Ya/Tidak)
   - `life_coverage_post_employment` 3 radio (Ya/Tidak/Tidak yakin)
3. **Estate section** (universal, always render setelah gate dijawab): 3 questions, masing-masing 3 radio
   - `estate_heirs_documented` (Pewaris terdokumentasi)
   - `estate_assets_documented` (Aset terdokumentasi)
   - `estate_will_exists` (Wasiat sudah ada)

**Files:**
- `src/tabs/kesehatan/Tier4Panel.tsx` — replace placeholder body dengan checklist component
- New helper component (optional): `src/tabs/kesehatan/Tier4Checklist.tsx` kalau Tier4Panel jadi terlalu besar

**Trade-off accepted:** Single scroll panel = panjang kalau has_dependents=true (6 questions estate + 3 asuransi jiwa). Mobile fine — accordion sudah expand inline below trapezoid. No nested accordion karena double-accordion confusing per UAT phase 13 feedback.

### C. Mutation pattern: Optimistic update via React Query

**Decision:** Pakai existing React Query mutation pattern (sama dengan transactions/goals di app):
- `useMutation({ mutationFn, onMutate, onSuccess, onError })`
- `onMutate`: snapshot prev, set optimistic value via `queryClient.setQueryData`
- `onError`: rollback ke snapshot + toast error
- `onSuccess`: invalidate `['protection_checklist', userId]` untuk refetch fresh state

**Mutation function:** Single upsert (PostgreSQL `INSERT ... ON CONFLICT (user_id) DO UPDATE`) — supabase-js syntax: `.upsert({ user_id, ...patch }, { onConflict: 'user_id' })`. Lazy create row di first interaction.

**Indicator color update:** Indikator hooks (`useIndikator()` dari Phase 13) consume `useProtectionChecklist()` query. Saat `setQueryData` flip jawaban → `useIndikator` recompute dengan data baru → IndikatorCard color flip langsung. Aggregation Tier color via `aggregateTierColor` (Phase 13) auto-update.

**Files:**
- `src/queries/protectionChecklist.ts` (NEW) — `useProtectionChecklist()` query + `useUpdateHealthCoverage()` + `useUpdateTier4()` mutations
- Reuse `src/queries/kesehatanTier1.ts` `computeAsuransiShell` (already reads `health_coverage`)

### D. Gate toggle behavior: Preserve answers, hide UI

**Decision:** User toggle "Ya" → isi asuransi jiwa → balik ke "Tidak":
- DB: `has_dependents` UPDATE ke `false` only. `life_coverage`, `life_coverage_sufficient`, `life_coverage_post_employment` STAY (preserve).
- UI: Asuransi Jiwa section hidden saat `has_dependents=false`. Estate section tetap visible (universal).
- Aggregation: Tier 4 color compute SKIP life_coverage* fields kalau `has_dependents=false` — hanya estate counted.

**Why:** Non-destructive UX. Kalau user toggle "Ya" lagi, jawaban kembali. Schema sudah no-op (allow NULL on all fields). No confirm dialog friction.

### E. Estate input: 3-state radio per item

**Decision:** Setiap dari 3 estate items: 3 radio inline `Ya / Tidak / Belum diisi`. Default `Belum diisi` (DB NULL). Match pattern `life_coverage_post_employment` enum (3-state).

**Storage mapping:**
- "Ya" → boolean `true`
- "Tidak" → boolean `false`
- "Belum diisi" → NULL (DB column nullable)

**Aggregation:**
- "Ya" = green untuk indicator
- "Tidak" = red untuk indicator
- NULL = treat sebagai "Tidak" untuk warna (red) ATAU sebagai "abu-abu" (TBD planner). Recommend RED biar push user fill.

### F. View-As mode: Form visible disabled + banner top

**Decision:** Saat `viewingAs !== null` (admin View-As mode):
- Form input semua `disabled` prop = true (radio + textarea + button greyed)
- Banner kuning di atas Tier 1 panel & Tier 4 panel: "Mode View-As: read-only — kamu lihat data {viewedUserEmail}, tidak bisa modify"
- Button "Simpan" hidden (atau disabled)
- Mutation function defensive guard: refuse kalau viewingAs aktif (defense-in-depth selain RLS `auth.uid() = user_id`)

**Files:**
- `Tier1Panel.tsx` + `Tier4Panel.tsx` — read `useViewAs()` hook (existing pattern, atau pakai `useTargetUserId() !== currentUserId`)
- Banner component bisa reuse existing toast/Alert pattern

**Why:** Konsisten dengan View-As pattern di /pensiun + /goals existing app. RLS sudah enforce di DB level (policy `WITH CHECK auth.uid() = user_id`), tapi UX defensive prevent admin click submit lalu confused.

</decisions>

<canonical_refs>
## Canonical References (READ FIRST during research/planning)

| Path | Why |
|------|-----|
| `docs/superpowers/specs/2026-05-08-framework-page-design.md` §4 inline checklist | Spec untuk Tier 1 #4 form (5 opsi enum + threshold warna) |
| `docs/superpowers/specs/2026-05-08-framework-page-design.md` §4 smart-gated | Spec untuk Tier 4 (gate + estate universal + asuransi jiwa conditional + threshold warna) |
| `docs/superpowers/specs/2026-05-08-framework-page-design.md` §7 schema | Field mapping `protection_checklist` → UI questions |
| `supabase/migrations/0029_protection_checklist.sql` | Column types + enum CHECK constraints + RLS policy (locked, zero schema change Phase 14) |
| `.planning/phases/13-diagnostic-data-indicators/13-CONTEXT.md` | Accordion pattern + IndikatorCard variants + View-As `useTargetUserId` (extend, jangan duplicate) |
| `.planning/phases/13-diagnostic-data-indicators/13-01-SUMMARY.md` | Tier panel infrastructure shipped (TierPanel, IndikatorCard, useIndikator, aggregateTierColor) |
| `src/queries/kesehatanTier1.ts computeAsuransiShell` | Existing Tier 1 #4 reader (Phase 13) — extend, jangan rewrite |
| `src/tabs/kesehatan/Tier4Panel.tsx` | Placeholder text shipped Phase 13 — full rewrite di Phase 14 |
| Existing mutation example (`useTransactions`/`useUpdateGoal` di codebase) | Optimistic update pattern reference untuk new `useUpdateProtectionChecklist` |

</canonical_refs>

<deferred>
## Deferred Ideas (Out of Phase 14 Scope)

- **Tier 4 indicator: yellow boundary** — Spec §4 hanya mention green/red. Yellow case TBD (e.g., "estate 2/3 ya")? → Defer planner judgment, lean ke green/red binary per spec literal.
- **NULL estate aggregation** — saat user belum fill 3 estate, color bagaimana? Recommend treat NULL = red (push user fill). Planner final call.
- **Edit history audit trail** — `updated_at` exists tapi no per-field history. Defer v1.3+ kalau audit perlu.
- **Bulk fill UX** — "Belum punya tanggungan, semua skip" 1-click? Defer v1.3.
- **Glossary tooltip** untuk istilah "estate"/"wasiat"/"BPJS" — defer Phase 15 (DIAG/STRAT module tooltips).
- **Dependents count input** — schema cuma boolean, tidak count. Defer v1.3.
</deferred>

<scope_creep_guard>
**Out of phase boundary (route ke roadmap backlog kalau muncul):**
- Tier 4 sebagai data-driven diagnostic (saat ini self-assessment) — already di PROJECT.md "Out of scope v1.2"
- Modul "Warisan & Estate Planning" konten — Phase 15 deliver modul edukasi
- IPS Builder, risk tolerance quiz — defer v1.3+
- Asset class normalization Tier 3 — already deferred v1.3
</scope_creep_guard>

## Next Step

`/gsd-plan-phase 14` — researcher will read CONTEXT.md + canonical refs, dan planner will create plans dengan decisions di atas locked.
