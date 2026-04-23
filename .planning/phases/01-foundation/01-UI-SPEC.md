---
phase: 1
slug: foundation
status: draft
shadcn_initialized: true
preset: radix-nova / neutral / cssVariables
created: 2026-04-23
---

# Phase 1 — UI Design Contract

> Visual and interaction contract untuk Phase 1: Foundation.
> Dihasilkan oleh gsd-ui-researcher. Dikonsumsi oleh gsd-planner, gsd-executor, dan gsd-ui-auditor.

**Catatan penting:** Ini adalah fase minimal UI. Satu-satunya perubahan UI adalah restrukturisasi tab navigasi (Goals → Finansial dengan 2 sub-tab). Tidak ada warna, spacing, atau tipografi baru — semua mewarisi sistem desain yang sudah ada.

---

## Design System

| Property | Value | Sumber |
|----------|-------|--------|
| Tool | shadcn/ui | `components.json` terdeteksi |
| Preset | `radix-nova`, baseColor: neutral, cssVariables: true | `components.json` |
| Style | `radix-nova` | `components.json` |
| Component library | Radix UI (via shadcn) | `components.json` |
| Icon library | Lucide React | `components.json` (`"iconLibrary": "lucide"`) |
| Font | Geist Variable | `src/index.css` (`@fontsource-variable/geist`) |
| Registry pihak ketiga | Tidak ada | `components.json` → `"registries": {}` |

---

## Spacing Scale

Skala 8-point yang sudah ada di aplikasi — tidak ada perubahan untuk fase ini.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap ikon inline, padding sub-trigger |
| sm | 8px | Spacing elemen kompak |
| md | 16px | Spacing elemen default, padding card |
| lg | 24px | Padding section |
| xl | 32px | Gap layout |
| 2xl | 48px | Pemisah section besar |
| 3xl | 64px | Spacing level halaman |

Exceptions: Tab trigger top-level menggunakan `px-4 py-2.5` (10px vertikal) untuk touch target — pola yang sudah ada di `src/App.tsx`. Sub-tab menggunakan default shadcn TabsList/TabsTrigger tanpa override.

---

## Typography

Semua nilai mewarisi dari Geist Variable yang sudah dikonfigurasi. Tidak ada token tipografi baru untuk fase ini.

| Role | Size | Weight | Line Height | Sumber |
|------|------|--------|-------------|--------|
| Body | 14px (`text-sm`) | 400 (regular) | 1.5 | Pola existing di PensiunTab, GoalsTab |
| Label | 12px (`text-xs`) | 400 (regular) | 1.5 | `<Label className="text-xs">` di PensiunTab |
| Heading | 14px (`text-sm`) | 600 (semibold) | 1.2 | `font-semibold text-sm` di PensiunTab |
| Sub-tab trigger | 14px (`text-sm`) | 500 (medium) | 1 | Default shadcn TabsTrigger |

---

## Color

Semua token warna sudah ada di `src/index.css`. Tidak ada token baru untuk fase ini.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` (oklch(1 0 0) light / oklch(0.145 0 0) dark) | Background halaman, permukaan utama |
| Secondary (30%) | `--card` / `--muted` | Card, border-b nav tab, area konten |
| Accent (10%) | `--brand` (#6366f1) | Active tab indicator, active tab text |
| Destructive | `--destructive` (oklch(0.577 0.245 27.325)) | Aksi hapus saja (bukan perubahan di fase ini) |

Accent `--brand` (#6366f1) **hanya** digunakan untuk:
- `border-b-2` active state pada top-level tab trigger (`data-[state=active]:border-[var(--brand)]`)
- Text color active tab trigger (`data-[state=active]:text-[var(--brand)]`)
- Active state pada shadcn default TabsTrigger untuk sub-tab FinansialTab

Tidak ada elemen accent baru yang ditambahkan di fase ini.

---

## Komponen yang Digunakan (Phase 1 UI)

Semua komponen sudah ada — tidak ada komponen baru yang diinstal.

### FinansialTab (file baru: `src/tabs/FinansialTab.tsx`)

Mengikuti pola PensiunTab **secara persis**:

```
<div className="space-y-6">
  <Tabs defaultValue="kekayaan" className="w-full">
    <TabsList className="mb-4">
      <TabsTrigger value="kekayaan">Kekayaan</TabsTrigger>
      <TabsTrigger value="goals">Goals</TabsTrigger>
    </TabsList>
    <TabsContent value="kekayaan">
      <KekayaanPlaceholder />
    </TabsContent>
    <TabsContent value="goals">
      <GoalsTab />
    </TabsContent>
  </Tabs>
</div>
```

**Binding keputusan (dari CONTEXT.md D-01 hingga D-04):**

| Keputusan | Nilai | Sumber |
|-----------|-------|--------|
| Tab `value` di TABS array | `'goals'` (tidak berubah) | D-01 — cegah persisted tab rusak |
| Label tab di TABS array | `'Finansial'` | D-01 |
| Icon tab | `Target` (Lucide) | D-02 — tidak berubah |
| Sub-tab `defaultValue` | `'kekayaan'` | D-03 |
| Sub-tab visual style | PensiunTab pattern (Tabs + TabsList + TabsTrigger + TabsContent dari shadcn) | D-04 |

### KekayaanPlaceholder (sub-komponen inline atau file terpisah)

Placeholder sederhana — pola coming-soon yang konsisten dengan loading state existing di aplikasi:

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <span className="text-muted-foreground text-sm">
    Fitur Kekayaan (Net Worth) akan hadir di Phase 2.
  </span>
</div>
```

Tidak ada icon dekoratif, tidak ada CTA — placeholder murni.

### Modifikasi App.tsx

Hanya dua perubahan pada entry `goals` di array TABS:

| Field | Nilai lama | Nilai baru |
|-------|-----------|-----------|
| `label` | `'Goals'` | `'Finansial'` |
| `Comp` | `GoalsTab` | `FinansialTab` |
| `value` | `'goals'` | `'goals'` (tidak berubah) |
| `icon` | `Target` | `Target` (tidak berubah) |

---

## Copywriting Contract

Hanya elemen yang relevan dengan perubahan UI fase ini.

| Elemen | Copy | Sumber |
|--------|------|--------|
| Label tab navigasi | `Finansial` | NAV-01, D-01 |
| Sub-tab Kekayaan | `Kekayaan` | NAV-01, D-03 |
| Sub-tab Goals | `Goals` | NAV-01 |
| Placeholder Kekayaan | `Fitur Kekayaan (Net Worth) akan hadir di Phase 2.` | Default (konten placeholder) |
| Loading state app | `Memuat...` (sudah ada, tidak berubah) | `src/App.tsx` |

Tidak ada CTA, empty state, error state, atau aksi destruktif baru di fase ini.

---

## Registry Safety

| Registry | Blocks Digunakan | Safety Gate |
|----------|-----------------|-------------|
| shadcn official | `tabs` (sudah terinstall di `src/components/ui/tabs.tsx`) | Tidak diperlukan — komponen resmi sudah ada |
| Pihak ketiga | Tidak ada | Tidak berlaku — `"registries": {}` di `components.json` |

Tidak ada blok baru yang diinstal dari registry manapun di fase ini.

---

## Interaction Contract

### Tab Navigation

- **Klik tab "Finansial":** Membuka FinansialTab, menampilkan sub-tab "Kekayaan" secara default (`defaultValue="kekayaan"`)
- **Klik sub-tab "Goals":** Menampilkan konten GoalsTab yang tidak berubah
- **Klik sub-tab "Kekayaan":** Menampilkan placeholder (fase ini), konten penuh di Phase 2
- **State persistensi:** `useTabStore` di `src/lib/tabStore` menyimpan top-level tab; nilai `'goals'` tetap valid (D-01)

### Tidak Ada Interaksi Baru

Fase ini tidak menambahkan:
- Modal / dialog baru
- Form baru
- Aksi destruktif baru
- Gesture atau keyboard shortcut baru

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Traceability

| Requirement | Keputusan UI | File yang Terpengaruh |
|-------------|-------------|----------------------|
| NAV-01 | Goals → Finansial + 2 sub-tab | `src/App.tsx`, `src/tabs/FinansialTab.tsx` (baru) |
| FOUND-01 | Tidak ada perubahan UI (bug fix di DB layer) | `src/db/recurringTransactions.ts` |
| FOUND-02 | Tidak ada perubahan UI (migrasi SQL) | `supabase/migrations/` |

---

*Phase: 01-foundation*
*UI-SPEC dibuat: 2026-04-23*
*Sumber utama: 01-CONTEXT.md (D-01–D-04), src/tabs/PensiunTab.tsx (pola kanonik), components.json, src/index.css*
