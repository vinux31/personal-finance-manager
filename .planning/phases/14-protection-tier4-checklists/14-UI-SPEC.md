---
phase: 14
slug: protection-tier4-checklists
status: draft
shadcn_initialized: true
preset: radix-nova (existing — components.json)
created: 2026-05-09
language: id
extends: phase-13 design tokens (kesehatanTypes.ts COLOR_BADGE_CLASS / COLOR_BORDER_CLASS, IndikatorCard layout, TierPanel shell)
---

# Phase 14 — UI Design Contract: Protection & Tier 4 Checklists

> Visual & interaction contract untuk Tier 1 #4 inline form (DIAG-04), Tier 4 smart-gated checklist (DIAG-09), dan View-As read-only mode (DIAG-12). Diturunkan dari Phase 13 design tokens — Phase 14 **extend, jangan duplicate**.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing) |
| Preset | `radix-nova` (lihat `components.json` baseline) |
| Component library | `radix-ui` umbrella ^1.4.3 (sama seperti Phase 12/13) |
| Icon library | `lucide-react` |
| Font | Geist Variable (`@fontsource-variable/geist`) — `--font-sans` token, body & heading |

**New shadcn component (Phase 14 only):**

| File | Pattern source | Notes |
|------|----------------|-------|
| `src/components/ui/radio-group.tsx` | Clone struktur `src/components/ui/checkbox.tsx` (radix-ui umbrella import + `cn` + `data-slot`) | Exports `RadioGroup` + `RadioGroupItem`. Verified `radix-ui.RadioGroup` primitive sudah tersedia (RESEARCH.md §StandardStack). Tidak ada install package baru. |

**Reused (no change):** `Button`, `Label`, `Skeleton`, `Tooltip`, `Accordion` (Phase 13), `Toaster` (sonner), `IndikatorCard`, `TierPanel`, `ViewAsBanner`.

---

## Spacing Scale

Phase 14 inherit skala 4-point Tailwind yang sudah dipakai sejak Phase 13 — **tidak ada token baru**.

| Token | Value | Usage di Phase 14 |
|-------|-------|---------------------|
| 1 (4px) | `gap-1`, `space-y-1` | Stale badge mini gap, sub-label spacing |
| 2 (8px) | `gap-2`, `space-y-2`, `p-2` | Radio-item gap, sub-section spacing, info row padding |
| 3 (12px) | `p-3`, `gap-3` | IndikatorCard inner padding (sama Phase 13), radio group horizontal gap |
| 4 (16px) | `p-4`, `space-y-4` | TierPanel outer padding (sama Phase 13), section spacing antar gate/life/estate |
| 6 (24px) | `pt-6` (border-t section divider) | Section break Tier 4 antara gate → life → estate (kalau visible) |
| 8 (32px) | `pb-8` | Mobile bottom padding panel saat keyboard friendly |

**Touch target minimum 44px** untuk mobile (radio item label clickable area):
- Native radio button visual ~16px circle, tapi clickable area = parent `<Label>` dengan `py-2 px-3` (≥44px tinggi via `min-h-11`).
- Verified WCAG 2.1 SC 2.5.5 (Target Size).

**Exceptions:** Threshold hint `text-[10px]` Phase 13 — diteruskan untuk konsistensi tapi catat di "Known issues" (Phase 13 UI-REVIEW finding #1, defer adjusment ke Phase 15 polish wave).

---

## Typography

Inherit Phase 13 — **tidak deklarasi baru**, hanya konfirmasi sizes yang akan dipakai di form Tier 1 & Tier 4.

| Role | Size (px) | Tailwind | Weight | Line height | Phase 14 Usage |
|------|-----------|----------|--------|-------------|---------------|
| Section heading | 16 | `text-base` | 600 (`font-semibold`) | 1.5 | "Asuransi Jiwa" / "Estate Planning" section title di Tier 4 |
| Question label | 14 | `text-sm` | 500 (`font-medium`) | 1.5 | Setiap pertanyaan radio (gate, health_coverage, life, estate) |
| Body / radio option label | 14 | `text-sm` | 400 (default) | 1.5 | "Kantor (asuransi grup)", "Ya", "Tidak", dst |
| Helper text / hint | 12 | `text-xs` | 400 | 1.4 | "Kalau ya, kami akan tampilkan checklist asuransi jiwa." (gate hint) |
| Inline notice / View-As banner | 14 | `text-sm` | 500 | 1.5 | "Mode View-As: read-only — kamu lihat data {email}" |
| Stale/state badge | 10 | `text-[10px]` | 400 | 1.2 | "Diperbarui {date}" (optional, low priority) |

**Catatan kategori:** 4 effective sizes (16 / 14 / 12 / 10) — sama seperti Phase 13. Tidak ada display headline (Phase 14 tidak punya page-level title baru; landing heading tetap milik Phase 13 KesehatanLanding).

**Weight pair:** `font-medium (500)` + `font-semibold (600)`. Default body weight 400. Match Phase 13.

---

## Color

Inherit Phase 13 token map (`COLOR_BADGE_CLASS` / `COLOR_BORDER_CLASS` di `kesehatanTypes.ts`). Phase 14 **tidak menambah palette baru**.

### 60/30/10 Split (form-level)

| Role | Token | Usage |
|------|-------|-------|
| Dominant (≈60%) | `bg-card` (oklch white di light, near-black di dark) | Form card background, radio group container, tier panel body |
| Secondary (≈30%) | `bg-muted/30` + `border-muted` | Section divider strip (gate vs life vs estate), radio container stroke |
| Accent (≈10%) | `--brand` indigo `#6366f1` (existing root token) | Primary submit button (saat NON View-As), focus ring radio item, edit icon hover |
| Destructive | `--destructive` (existing) | Error toast saat mutation fail (sonner.error) — bukan UI surface utama |

**Accent reserved for:**
1. Primary "Simpan" button di Tier 1 #4 form-edit mode (saat IndikatorCard flip ke radio mode).
2. Focus ring (`focus-visible:ring-[var(--brand)]`) di RadioGroupItem.
3. Edit pencil icon hover state (Tier 1 #4 compute-state, di pojok kanan card).
4. **Tidak boleh** dipakai di label, helper text, atau radio fill (radio active state pakai `data-[state=checked]:bg-primary` shadcn default).

### Indikator state (radio answer → indicator color reactive)

Reuse Phase 13 4-state palette (no new color):

| Indikator state | Tier 1 #4 (DIAG-04) | Tier 4 estate item | Tier 4 life_coverage |
|-----------------|---------------------|---------------------|----------------------|
| Green (`COLOR_BADGE_CLASS.green`) | health_coverage ∈ {kantor, bpjs, pribadi, kombinasi} | "Ya" | {kantor, pribadi, keduanya} |
| Red (`COLOR_BADGE_CLASS.red`) | health_coverage = "tidak" OR NULL (belum diisi → push) | "Tidak" OR NULL (push fill — locked decision in CONTEXT.md) | "tidak" |
| Yellow | **N/A Phase 14** — locked binary green/red per spec (CONTEXT.md deferred §yellow) | N/A | N/A |
| Gray (`COLOR_BADGE_CLASS.gray`) | Hanya saat row tidak exist DAN user belum buka panel | Hanya kalau gate (`has_dependents`) belum dijawab | Sama dengan estate |

### Inline View-As notice (panel-level)

Distinct dari `ViewAsBanner` global (sudah dirender di `AppShell.tsx`). Inline notice di top tiap panel (Tier 1 + Tier 4) memakai amber palette identik:

```
bg-amber-50 dark:bg-amber-950
border border-amber-200 dark:border-amber-800
text-amber-800 dark:text-amber-200
icon: <Eye className="h-4 w-4" />
```

Copy: lihat **Copywriting Contract** §View-As notice.

### Disabled state (View-As mode)

| Element | Disabled visual |
|---------|----------------|
| RadioGroupItem | `data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed` (radix default) + parent `<Label>` `peer-disabled:opacity-50` |
| Submit Button | Hidden (`isViewAs && hidden`) — bukan disabled, supaya form tampak read-only ringkas |
| Edit pencil icon (Tier 1 #4) | Hidden saat View-As — tidak ada path edit |

---

## Component Anatomy

### Component 1 — IndikatorCard variant `form-radio` (Tier 1 #4 only)

Extend `IndikatorResult` union dengan kind tambahan, ATAU wrap IndikatorCard dengan internal `isEditing` state. **Recommended approach:** wrap di Tier1Panel level (jangan polusi IndikatorCard untuk satu kasus).

**Layout (3-state machine):**

```
┌─ State A: NULL/empty (red border-l-4) ─────────────────────────┐
│ [⚠] Asuransi Kesehatan                  [Belum diisi badge red]│
│     Covered (kantor/BPJS/dst) hijau · belum diisi atau tidak red│
│     [→ Pilih cover]                                             │
└─────────────────────────────────────────────────────────────────┘

┌─ State B: editing (still red border, body swap) ───────────────┐
│  Asuransi Kesehatan                                             │
│  [○] Kantor (asuransi grup)                                     │
│  [○] BPJS                                                       │
│  [○] Pribadi (beli sendiri)                                     │
│  [●] Kombinasi (kantor + pribadi)                               │
│  [○] Tidak / belum tahu                                         │
│                                                                  │
│  [Batal]                                       [Simpan ▸]       │
└─────────────────────────────────────────────────────────────────┘

┌─ State C: filled (green border-l-4) ───────────────────────────┐
│ Asuransi Kesehatan                  [Kombinasi badge green] [✎]│
│     Covered (kantor/BPJS/dst) hijau · belum diisi atau tidak red│
└─────────────────────────────────────────────────────────────────┘
```

**Interaction:**

- Klik "Pilih cover →" (State A) → switch ke State B, radio default unselected.
- Klik pencil (State C) → switch ke State B dengan radio pre-selected dari `health_coverage`.
- Klik "Simpan" → optimistic `setQueryData` → card re-render State C dengan warna baru → `mutateAsync` → success toast "Tersimpan" / error rollback + toast.
- Klik "Batal" → revert ke State sebelumnya tanpa mutation.
- Saat View-As: State A & State C tetap render sama, **tanpa button Pilih/pencil**. State B tidak reachable.

**Tokens:** Inherit IndikatorCard `rounded-lg border border-l-4 bg-card p-3` + `space-y-2` (Phase 13).

### Component 2 — Tier 4 ProtectionGate (gate question)

```
┌─ Tier4Panel top section (always render after panel expand) ────┐
│  Punya tanggungan finansial (anak, pasangan, ortu)?             │
│  [○] Ya                                                          │
│  [●] Tidak                                                       │
│                                                                  │
│  Kalau ya, kami tampilkan checklist asuransi jiwa.              │
└─────────────────────────────────────────────────────────────────┘
```

- Layout: vertical radio stack (consistency dengan Tier 1 form), `gap-2` antar item.
- Auto-save on `onValueChange` (no Submit button — locked decision optimistic per CONTEXT.md §C).
- Optimistic flip: `has_dependents=true` → render Asuransi Jiwa section di bawah; `false` → hide section (preserve life_* values per locked decision §D).
- Saat NULL (row baru, gate belum dijawab): render gate dengan no radio selected; Estate section + Life section both hidden.

### Component 3 — Tier4LifeSection (conditional, has_dependents=true)

3 question blocks vertical, separated by `border-t pt-4` divider:

```
Asuransi Jiwa  (heading text-base font-semibold)

  Apakah kamu punya asuransi jiwa?
  [○] Kantor (asuransi grup)
  [○] Pribadi (beli sendiri)
  [○] Keduanya
  [○] Tidak

  Apakah jumlah pertanggungan cukup (10x penghasilan tahunan)?
  [○] Ya     [○] Tidak

  Tetap aktif setelah keluar dari kantor?
  [○] Ya     [○] Tidak     [○] Tidak yakin
```

- Setiap pertanyaan: `<Label>` (text-sm font-medium) di atas, `<RadioGroup>` `flex flex-wrap gap-3` (untuk 2-3 options inline) atau `flex flex-col gap-2` (untuk 4 options vertical).
- Auto-save per radio change.

### Component 4 — Tier4EstateSection (universal, after gate answered)

3 estate items, masing-masing 3-state radio (Ya / Tidak / Belum diisi):

```
Estate Planning  (heading text-base font-semibold)

  Pewaris (ahli waris) sudah teridentifikasi & terdokumentasi?
  [○] Ya     [○] Tidak     [●] Belum diisi

  Daftar aset kamu sudah terdokumentasi (kontak, lokasi, nomor)?
  [○] Ya     [●] Tidak     [○] Belum diisi

  Surat wasiat sudah ada (notaris atau private)?
  [●] Ya     [○] Tidak     [○] Belum diisi
```

- 3-state radio inline `flex flex-wrap gap-3`.
- "Belum diisi" maps ke DB NULL (locked decision §E).
- Aggregation: NULL = treated as red (push fill — locked decision in CONTEXT.md additional context "NULL estate aggregation → red").

### Component 5 — Inline View-As Notice (panel-level)

Render di TOP body Tier 1 & Tier 4 panels saat `viewingAs !== null`:

```
┌─────────────────────────────────────────────────────────────────┐
│ [👁] Mode View-As — kamu hanya bisa lihat,  tidak bisa simpan.  │
└─────────────────────────────────────────────────────────────────┘
```

Tokens (cocok ViewAsBanner global):
- `rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800`
- `px-3 py-2 text-sm text-amber-800 dark:text-amber-200`
- `flex items-center gap-2`
- Icon `<Eye className="h-4 w-4" />`

**Bukan duplikasi:** Banner global di AppShell sifatnya app-wide; inline notice di panel ini reminder kontekstual saat user expand tier panel (form context jelas read-only sebelum klik radio).

### Component 6 — RadioGroup primitive contract

File baru: `src/components/ui/radio-group.tsx`. Mengikuti pola `checkbox.tsx`:

```tsx
import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="relative flex items-center justify-center">
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
```

**Note:** Pattern ini IDENTICAL dengan shadcn official radio-group preset — verifikasi terhadap `https://ui.shadcn.com/docs/components/radio-group` saat plan-phase.

---

## Copywriting Contract

Tone: **Bahasa Indonesia kasual ("kamu"), trustworthy/calm**, sama seperti Phase 13 (KesehatanLanding "Lihat kondisi keuangan **kamu**"). Hindari jargon English raw kecuali term financial standard ("BPJS", "estate planning" pakai "Surat wasiat").

### Tier 1 #4 (DIAG-04) — Asuransi Kesehatan inline form

| Element | Copy (id) |
|---------|-----------|
| Card label | `Asuransi Kesehatan` |
| Threshold hint (existing Phase 13) | `Covered (kantor/BPJS/dst) hijau · belum diisi atau tidak covered merah` |
| State A badge | `Belum diisi` |
| State A CTA button | `Pilih cover` (+ icon `ArrowRight`) |
| State B question label | `Kesehatan kamu (& keluarga) tercover?` |
| Radio option `kantor` | `Kantor (asuransi grup)` |
| Radio option `bpjs` | `BPJS` |
| Radio option `pribadi` | `Pribadi (beli sendiri)` |
| Radio option `kombinasi` | `Kombinasi (kantor + pribadi)` |
| Radio option `tidak` | `Tidak / belum tahu` |
| State B Cancel button | `Batal` |
| State B Submit button | `Simpan` |
| State C edit icon `aria-label` | `Edit asuransi kesehatan` |
| Success toast | `Tersimpan` |
| Error toast | `Gagal simpan: {mapSupabaseError(err)}` |
| State C value display (badge text) | Title-case mapping: `Kantor` / `BPJS` / `Pribadi` / `Kombinasi` / `Tidak` |

### Tier 4 (DIAG-09) — Smart-gated checklist

#### Gate section

| Element | Copy (id) |
|---------|-----------|
| Section heading (optional, may omit) | — (no heading; gate stands alone at top) |
| Question label | `Punya tanggungan finansial (anak, pasangan, ortu)?` |
| Helper text below | `Kalau ya, kami tampilkan checklist asuransi jiwa.` |
| Radio `true` | `Ya` |
| Radio `false` | `Tidak` |

#### Asuransi Jiwa section (when has_dependents=true)

| Element | Copy (id) |
|---------|-----------|
| Section heading | `Asuransi Jiwa` |
| Q1 `life_coverage` label | `Apakah kamu punya asuransi jiwa?` |
| Q1 option `kantor` | `Kantor (asuransi grup)` |
| Q1 option `pribadi` | `Pribadi (beli sendiri)` |
| Q1 option `keduanya` | `Keduanya` |
| Q1 option `tidak` | `Tidak` |
| Q2 `life_coverage_sufficient` label | `Apakah jumlah pertanggungan cukup (10× penghasilan tahunan)?` |
| Q2 option `true` | `Ya` |
| Q2 option `false` | `Tidak` |
| Q3 `life_coverage_post_employment` label | `Tetap aktif setelah keluar dari kantor?` |
| Q3 option `ya` | `Ya` |
| Q3 option `tidak` | `Tidak` |
| Q3 option `tidak_yakin` | `Tidak yakin` |

#### Estate Planning section (universal after gate answered)

| Element | Copy (id) |
|---------|-----------|
| Section heading | `Estate Planning` |
| Q1 `estate_heirs_documented` label | `Pewaris (ahli waris) sudah teridentifikasi & terdokumentasi?` |
| Q2 `estate_assets_documented` label | `Daftar aset kamu sudah terdokumentasi (kontak, lokasi, nomor)?` |
| Q3 `estate_will_exists` label | `Surat wasiat sudah ada (notaris atau private)?` |
| All 3 options (3-state) | `Ya` / `Tidak` / `Belum diisi` |

#### Tier 4 panel auxiliary copy

| Element | Copy (id) |
|---------|-----------|
| Empty state (gate belum dijawab) sub-text | (Tidak ada empty state khusus — gate jadi konten paling top, langsung ajak user jawab) |
| Success toast (per radio change) | `Tersimpan` |
| Error toast | `Gagal simpan: {mapSupabaseError(err)}` |

### View-As inline notice (DIAG-12)

| Element | Copy (id) |
|---------|-----------|
| Banner text | `Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.` |
| Banner icon | `<Eye />` (lucide-react, h-4 w-4) |

### Standard interaction copy

| Element | Copy (id) |
|---------|-----------|
| Primary CTA (form submit, Tier 1 #4) | `Simpan` |
| Cancel CTA (form abort, Tier 1 #4) | `Batal` |
| Empty state (Tier 4 saat row belum exist) | (No banner — gate question is its own onboarding) |
| Loading skeleton text | (No text — pakai `<Skeleton>` shape Phase 13) |
| Error state (mutation fail) | `Gagal simpan: {mapSupabaseError(err)}` (sonner.error toast, 4s duration) |

### Destructive actions

**None.** Phase 14 tidak ada destructive action:
- Toggle gate "Ya" → "Tidak" **NON-destructive** (preserve life_* values per locked decision §D). Tidak butuh confirm.
- Edit Tier 1 #4 dari kombinasi → tidak (downgrade) **NON-destructive** (overwrite is normal user intent). Tidak butuh confirm.
- Tidak ada delete row, tidak ada reset all.

---

## Interaction Contract

| Trigger | Behavior | Optimistic? | Toast |
|---------|----------|-------------|-------|
| Klik "Pilih cover" (Tier 1 #4 State A) | Card flip ke State B (form mode), radio unselected | N/A (UI-only) | — |
| Klik pencil (Tier 1 #4 State C) | Card flip ke State B dengan radio pre-selected | N/A (UI-only) | — |
| Klik "Simpan" (Tier 1 #4 State B) | `setQueryData` → flip ke State C dengan warna baru → `upsert({ user_id, health_coverage })` | YES | success: "Tersimpan" / error: rollback + "Gagal simpan: ..." |
| Klik "Batal" (Tier 1 #4 State B) | Revert ke State A atau C (whichever was source) | N/A | — |
| Pilih radio gate Tier 4 (`has_dependents`) | `setQueryData(has_dependents=value)` → optimistic show/hide life section → `upsert({ user_id, has_dependents })` | YES | success: "Tersimpan" / error: rollback + toast |
| Pilih radio life/estate (any) | `setQueryData(field=value)` → optimistic indicator color update via useIndikator → `upsert({ user_id, [field]: value })` | YES | success: "Tersimpan" / error: rollback + toast |
| View-As mode active (`viewingAs !== null`) | All radios `disabled`, Submit hidden, pencil hidden, banner inline | N/A | — |
| Submit attempt while View-As (defensive) | Mutation throws `Error('Tidak boleh modify data user lain (View-As mode)')` di JS layer + RLS 42501 dari DB | N/A | error toast |
| Loading state (initial `useProtectionChecklist`) | Inherit Phase 13 — skeleton card placeholder (no new pattern) | N/A | — |

### Optimistic update protocol (per CONTEXT.md §C)

1. `onMutate` → `qc.cancelQueries(['kesehatan', 'protection-checklist', uid])`
2. Snapshot `qc.getQueryData(...)` (typed as `ProtectionChecklistRow | null`)
3. `qc.setQueryData(...)` dengan partial patch merged: `{ ...(old ?? {user_id: uid}), ...patch }`
4. UI auto-recompute via `useIndikator` useMemo (Phase 13 wired). IndikatorCard / TierColors flip langsung.
5. `onError` → `qc.setQueryData(snapshot)` rollback + `toast.error(mapSupabaseError(err))`
6. `onSuccess` → `toast.success('Tersimpan')`
7. `onSettled` → `qc.invalidateQueries(['kesehatan', 'protection-checklist', uid])` untuk reconcile dengan server

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | Native radix `RadioGroup` keyboard support (←↑→↓ navigate, Space select). Already part of `radix-ui` umbrella. |
| Focus visible | `focus-visible:ring-ring/50 focus-visible:ring-[3px]` on `RadioGroupItem` (radix-nova preset default). |
| Touch targets | Wrap `<RadioGroupItem>` + `<Label>` in `<div className="flex items-center gap-2 py-2 min-h-11">` for ≥44px touch area. |
| ARIA labels | `<Label htmlFor={id}>` paired with `<RadioGroupItem id={id}>`. Question label wraps RadioGroup with `<fieldset><legend>`. |
| Screen reader announcements | Use `aria-live="polite"` on optimistic state container (Tier4Panel root) so SR announces "Tersimpan" toast (sonner already has aria-live). |
| Disabled state SR | Native `disabled` attr propagates `aria-disabled` via radix. |
| View-As notice | Notice rendered via `<div role="status" aria-live="polite">` so SR announces saat panel expand di View-As mode. |
| Color-not-only | All states (red/green) accompanied by text label ("Belum diisi", "Kombinasi") — never color-only. |

---

## Mobile Breakpoint Behavior

Inherit Phase 13 PiramidaShell breakpoints (375px target). Phase 14 forms:

| Breakpoint | Layout |
|------------|--------|
| `< 640px` (mobile) | RadioGroup `flex flex-col gap-2` (vertical stack) untuk 2-state (Ya/Tidak). 4+ options also vertical. Min-h-11 per item. |
| `≥ 640px` (sm) | RadioGroup `flex flex-wrap gap-3` (inline horizontal) untuk 2-3 state options. 4+ options tetap vertical. |
| `≥ 1024px` (lg) | Sama seperti sm. Tier panel sudah constrained `max-w-2xl mx-auto` di KesehatanLanding (Phase 13). |

**Specific decisions:**
- Tier 1 #4 State B (5 options): always vertical stack (mobile + desktop) — 5 options inline terlalu padat.
- Tier 4 Gate (Ya/Tidak): inline `gap-3` di sm+, vertical di mobile.
- Tier 4 estate (3-state Ya/Tidak/Belum diisi): inline `gap-3` di sm+, vertical di mobile.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `radio-group` (NEW Phase 14), `accordion`, `button`, `label`, `tooltip`, `sonner` (existing) | not required (official registry) |

**Third-party registries:** none declared.

---

## Pre-populated Sources

| Source | Decisions Used |
|--------|---------------|
| `14-CONTEXT.md` | Locked decisions A-F (inline form layout, gate-conditional, optimistic mutation, gate preserve, 3-state estate, View-As disabled banner) |
| `14-RESEARCH.md` | Stack confirmed (radix-ui umbrella `RadioGroup` available, no install), file structure (`src/components/ui/radio-group.tsx` new) |
| `13-UI-REVIEW.md` | Inherited 6-pillar baseline + Phase 13 known issues (threshold hint 10px → carry-forward, not Phase 14 scope) |
| Phase 13 `kesehatanTypes.ts` | `COLOR_BADGE_CLASS`, `COLOR_BORDER_CLASS`, `IndikatorResult` union, threshold tokens |
| Phase 13 `IndikatorCard.tsx` | 3-variant card layout (compute / placeholder / cta-fallback) — Phase 14 add 4th wrapping pattern |
| `src/components/ViewAsBanner.tsx` | Amber banner palette (bg-amber-50/950, border-amber-200/800, text-amber-800/200) — reused for inline notice |
| `components.json` | Preset `radix-nova`, baseColor `neutral`, icon `lucide`, alias `@/components/ui` |
| `additional_context` (orchestrator) | "Native useState + onChange — NOT react-hook-form (zero usage in codebase)", "Auto-save per radio onValueChange (no Submit button)" — applied to Tier 4; Tier 1 #4 explicit Save button per CONTEXT.md UX flow #3 |

---

## Known Issues (carry-forward, not Phase 14 scope)

| Issue | Source | Disposition |
|-------|--------|-------------|
| Threshold hint `text-[10px]` terlalu kecil di mobile | Phase 13 UI-REVIEW finding #1 | Carry to v1.3 polish phase. Phase 14 menyentuh IndikatorCard cuma sebatas wrap form-mode — TIDAK fix typography ini supaya scope tetap ketat. |
| `yellow` key vs `bg-amber-*` class naming inconsistency | Phase 13 UI-REVIEW Pillar 3 | Carry. Phase 14 reuse token apa adanya. |
| Empty state Tier 4 panel saat data baru — visual ambigu | Phase 13 UI-REVIEW finding #2 | **RESOLVED by Phase 14** — Tier 4 placeholder digantikan dengan gate question + sections aktif. Tidak ada lock-icon timeline (already in production). |

---

## Auto-save vs Explicit Save Decision Matrix

Aturan locked: Tier 1 #4 = **explicit Save** (per CONTEXT.md UX flow #3 — "card flip → button Simpan"). Tier 4 = **auto-save per radio change** (per orchestrator additional_context "Auto-save per radio onValueChange").

**Rationale:**
- Tier 1 #4 satu pertanyaan saja — explicit Save = 1 klik tambahan, OK karena card flip animation memberi konteks "edit mode aktif". User bisa Cancel kalau salah pilih.
- Tier 4 banyak pertanyaan (gate + 3 estate + opsional 3 life = up to 7) — auto-save mengurangi friction. Optimistic update memberi feedback instan via indicator color flip. Cancel-by-toggle-back tetap NON-destructive (locked §D).

**Konsekuensi UI:**
- Tier 1 #4 form has Save/Cancel buttons (State B).
- Tier 4 has **NO Submit button anywhere**. Hanya radio + auto-save.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
